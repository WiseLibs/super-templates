'use strict';
const { ast } = require('../../parser');

/*
	Computes the variables in scope of each EmbeddedJS within all included ASTs.
	Also, the scopes are compared to the identifiers referenced in each
	expression, in order to compute which AST nodes are dependencies of each
	EmbeddedJS object.
 */

module.exports = (rootAST) => {
	const visited = new Set([rootAST]);

	(function walkInScope(theAST, scope) {
		(function walk(nodes) {
			for (const node of nodes) {
				if (node.js) {
					node.js.scope = [...scope.keys()];
					node.js.dependencies = lookupDependencies(node.js);
				}
				if (node instanceof ast.IncludeNode) {
					for (const binding of node.bindings) {
						binding.js.scope = [...scope.keys()];
						binding.js.dependencies = lookupDependencies(binding.js);
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
					walkInScope(node.trueBranch, newScope);
					walk(node.falseBranch);
				} else if (node instanceof ast.TransformNode) {
					if (!scope.has('__block')) {
						node.js.scope.push('__block');
					}
				} else {
					walk(node.children);
				}
			}
		})(theAST);

		function lookupDependencies(js) {
			const dependencies = [];
			for (const name of js.names) {
				// TODO: this could result in a false positive if the JS expression
				// has names that refer to declarations in inline function literals
				const node = scope.get(name);
				if (node) dependencies.push(node);
			}
			return dependencies;
		}
	})(rootAST, new Map());
};
