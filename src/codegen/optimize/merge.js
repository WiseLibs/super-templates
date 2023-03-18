'use strict';
const asm = require('../asm');

module.exports = (rootTemplate) => {
	if (!(rootTemplate instanceof asm.TemplateFunc)) {
		throw new TypeError('Expected rootTemplate to be a TemplateFunc object');
	}

	const visited = new Set([rootTemplate]);
	merge(rootTemplate.children);

	function merge(nodes) {
		let literal;
		for (let i = 0; i < nodes.length; ++i) {
			const node = nodes[i];
			if (node instanceof asm.PrintLiteral) {
				if (literal) {
					literal.content += node.content;
					nodes.splice(i--, 1);
				} else {
					literal = node;
				}
			} else {
				literal = undefined;
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
