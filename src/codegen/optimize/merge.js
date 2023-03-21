'use strict';
const asm = require('../asm');

/*
	Merges adjacent PrintLiterals and merges adjacent DynamicIndentations,
	significantly reducing the total number of operations required to execute a
	template. This optimization is most effective when used after the "bake"
	and "bubble" optimizations.
 */

module.exports = (rootTemplate) => {
	if (!(rootTemplate instanceof asm.TemplateFunc)) {
		throw new TypeError('Expected rootTemplate to be a TemplateFunc object');
	}

	const visited = new Set([rootTemplate]);
	merge(rootTemplate.children);

	function merge(nodes) {
		let prevNode;
		for (let i = 0; i < nodes.length; ++i) {
			const node = nodes[i];
			if (node instanceof asm.PrintLiteral) {
				if (prevNode instanceof asm.PrintLiteral) {
					prevNode.content += node.content;
					nodes.splice(i--, 1);
				} else {
					prevNode = node;
				}
			} else if (node instanceof asm.DynamicIndentation) {
				if (prevNode instanceof asm.DynamicIndentation
					&& prevNode.indentation === node.indentation
				) {
					prevNode.children.push(...node.children);
					nodes.splice(i--, 1);
				} else {
					prevNode = node;
				}
			} else {
				prevNode = undefined;
			}
		}

		for (const node of nodes) {
			if (node instanceof asm.DynamicInclude) {
				for (const section of node.sections.values()) {
					merge(section);
				}
				if (!visited.has(node.ref)) {
					visited.add(node.ref);
					merge(node.ref.children);
				}
			} else {
				if (node.children) {
					merge(node.children);
				} else if (node.trueBranch) {
					merge(node.trueBranch);
					merge(node.falseBranch);
				}
			}
		}
	}
};
