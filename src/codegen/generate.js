'use strict';
const { ast } = require('../parser');
const CodegenContext = require('./context');
const computeScopes = require('./compute-scopes');

/*
	Generates the code for a given template AST.
 */

module.exports = (rootAST, codegen) => {
	if (!Array.isArray(rootAST)) {
		throw new TypeError('Expected rootAST to be an array');
	}

	computeScopes(rootAST);

	const visited = new Set([rootAST]);
	const ctx = new CodegenContext();
	const code = ['"use strict";\n'];
	const queue = [rootAST];

	while (queue.length) {
		const theAST = queue.shift();
		code.push(codegen.ast(theAST, ctx));
		walk(theAST);
	}

	function walk(nodes) {
		for (const node of nodes) {
			code.push(codegen.node.get(node.constructor)(node, ctx));

			if (node instanceof ast.IncludeNode) {
				for (const binding of node.bindings) {
					code.push(codegen.js(binding.js, ctx));
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
				node.js && code.push(codegen.js(node.js, ctx));
				walk(node.children);
			}
		}
	}

	code.push(codegen.root(rootAST, ctx));

	return code.join('');
};
