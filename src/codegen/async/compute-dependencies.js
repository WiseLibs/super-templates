'use strict';
const { ast } = require('../../parser');

/*
	Computes the dependencies of each JavaScript expression in each included
	AST. Each depenendecy is a LetNode/EachNode that provides a variable needed
	by the JavaScript expression.
 */

module.exports = (rootAST) => {
	const visited = new Set([rootAST]);

	(function walkInScope(theAST, scope) {
		(function walk(nodes) {
			for (const node of nodes) {
				if (node.js) {
					lookupDependencies(node.js);
				}
				if (node instanceof ast.IncludeNode) {
					for (const binding of node.bindings) {
						lookupDependencies(binding.js);
					}
					walk(node.children);
					if (!visited.has(node.ref)) {
						visited.add(node.ref);
						walkInScope(node.ref, new Map());
					}
				} else if (node instanceof ast.LetNode) {
					const newScope = new Map(scope);
					newScope.set(node.name, node);
					walkInScope(node.children, newScope);
				} else if (node instanceof ast.EachNode) {
					const newScope = new Map(scope);
					newScope.set(node.name, node);
					node.indexName && newScope.set(node.indexName, node);
					walkInScope(node.children, newScope);
				} else {
					walk(node.children);
				}
			}
		})(theAST);

		function lookupDependencies(js) {
			js.dependencies = [];
			for (const name of js.names) {
				// TODO: this could result in a false positive if the JS expression
				// has names that refer to declarations in inline function literals
				const node = scope.get(name);
				if (node) js.dependencies.push(node);
			}
		}
	})(rootAST, new Map());
};
