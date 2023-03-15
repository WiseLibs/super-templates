'use strict';
const { ast } = require('../../parser');
const CodegenContext = require('./context');
const gen = require('./codegen');

/*
	Generates the code for a synchronous-only template.
 */

module.exports = (rootAST) => {
	if (!Array.isArray(rootAST)) {
		throw new TypeError('Expected rootAST to be an array');
	}

	const visited = new Set([rootAST]);
	const ctx = new CodegenContext();
	const code = ['"use strict";\n'];
	const queue = [rootAST];

	while (queue.length) {
		const theAST = queue.shift();
		code.push(gen.ast(theAST, ctx));
		walk(theAST);
	}

	function walk(nodes) {
		for (const node of nodes) {
			code.push(gen.node.get(node.constructor)(node, ctx));

			if (node instanceof ast.IncludeNode) {
				for (const binding of node.bindings) {
					code.push(gen.js(binding.js, ctx));
				}
				const implicitSection = node.sections.find(x => x.name === '');
				if (implicitSection) {
					walk([implicitSection]);
				} else {
					walk(node.sections);
				}
				if (!visited.has(node.ref)) {
					visited.add(node.ref);
					queue.push(node.ref);
				}
			} else {
				node.js && code.push(gen.js(node.js, ctx));
				walk(node.children);
			}
		}
	}

	code.push(gen.root(rootAST, ctx));

	return code.join('');
};
