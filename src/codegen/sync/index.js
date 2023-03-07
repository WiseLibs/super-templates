'use strict';
const { ast } = require('../../parser');
const CodegenContext = require('./context');
const gen = require('./codegen');

// TODO: add source location to errors thrown by check()
// TODO: add source location to errors thrown by user-defined JS

module.exports = (rootAST) => {
	if (!Array.isArray(rootAST)) {
		throw new TypeError('Expected rootAST to be an array');
	}

	const visited = new Set([rootAST]);
	const ctx = new CodegenContext();
	const code = [];
	code.push(gen.STRICT);
	// code.push(gen.WRITE);
	code.push(gen.CHECK);
	code.push(gen.ESCAPE);
	code.push(gen.SCOPE);

	(function walk(nodes) {
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
					walk(node.ref);
				}
			} else {
				node.js && code.push(gen.js(node.js, ctx));
				walk(node.children);
			}
		}
	})(rootAST);

	code.push(gen.INITIAL_SCOPE);
	code.push(...rootAST.map(node => `${ctx.name(node)}(initialScope);\n`));

	return code.join('');
};
