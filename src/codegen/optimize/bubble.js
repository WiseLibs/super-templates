'use strict';
const asm = require('../asm');

/*
	Bubbles DynamicIndentations to encompass their ancestors in the IR tree,
	when doing so would not change the template's output, and all nodes within
	the ancestor would've had the same dynamic indentation applied anyways. This
	optimization can reduce the number of DynamicIndentations within the IR, and
	is most effective when used after the "bake" optimization.
 */

module.exports = (rootTemplate) => {
	if (!(rootTemplate instanceof asm.TemplateFunc)) {
		throw new TypeError('Expected rootTemplate to be a TemplateFunc object');
	}

	const visited = new Set([rootTemplate]);
	const queue = [rootTemplate];

	while (queue.length) {
		const template = queue.shift();
		bubble(template.children);
		const commonIndentation = getCommonIndentation(template.children);
		if (commonIndentation !== null) {
			const children = withoutIndentations(template.children);
			template.children = [new asm.DynamicIndentation(commonIndentation, children)];
		}
	}

	function bubble(nodes) {
		for (let i = 0; i < nodes.length; ++i) {
			const node = nodes[i];
			if (node instanceof asm.DynamicInclude) {
				for (const [name, section] of node.sections) {
					bubble(section);
					const commonIndentation = getCommonIndentation(section);
					if (commonIndentation !== null) {
						const children = withoutIndentations(section);
						node.sections.set(name, [new asm.DynamicIndentation(commonIndentation, children)]);
					}
				}
				if (!visited.has(node.ref)) {
					visited.add(node.ref);
					queue.push(node.ref);
				}
			} else if (node instanceof asm.TransformBlock) {
				bubble(node.children);
				const commonIndentation = getCommonIndentation(node.children);
				if (commonIndentation !== null) {
					const children = withoutIndentations(node.children);
					node.children = [new asm.DynamicIndentation(commonIndentation, children)];
				}
			} else if (node instanceof asm.DynamicIndentation) {
				bubble(node.children);
				const commonIndentation = getCommonIndentation(node.children);
				if (commonIndentation !== null) {
					node.children = withoutIndentations(node.children);
					node.indentation += commonIndentation;
				}
			} else if (node.children) {
				bubble(node.children);
				const commonIndentation = getCommonIndentation(node.children);
				if (commonIndentation !== null) {
					node.children = withoutIndentations(node.children);
					nodes[i] = new asm.DynamicIndentation(commonIndentation, [node]);
				}
			} else if (node.trueBranch) {
				bubble(node.trueBranch);
				bubble(node.falseBranch);
				const commonIndentation = getCommonIndentation([...node.trueBranch, ...node.falseBranch]);
				if (commonIndentation !== null) {
					node.trueBranch = withoutIndentations(node.trueBranch);
					node.falseBranch = withoutIndentations(node.falseBranch);
					nodes[i] = new asm.DynamicIndentation(commonIndentation, [node]);
				}
			}
		}
	}
};

function getCommonIndentation(nodes) {
	let commonIndentation = null;
	for (const node of nodes) {
		if (node instanceof asm.DynamicIndentation) {
			if (commonIndentation === null) {
				commonIndentation = node.indentation;
			} else if (commonIndentation !== node.indentation) {
				return null;
			}
		} else if (!(node instanceof asm.Effect)) {
			return null;
		}
	}
	return commonIndentation;
}

function withoutIndentations(nodes) {
	const children = [];
	for (const node of nodes) {
		if (node instanceof asm.DynamicIndentation) {
			children.push(...node.children);
		} else {
			children.push(node);
		}
	}
	return children;
}
