'use strict';
const { ast } = require('../parser');
const asm = require('./asm');

module.exports = (rootAST) => {
	if (!Array.isArray(rootAST)) {
		throw new TypeError('Expected rootAST to be an array');
	}

	const recursiveASTs = findRecursiveASTs(rootAST);
	const inlineStack = [];
	const templates = new Map();
	const includes = new Map([[rootAST, []]]);
	const queue = [rootAST];

	while (queue.length) {
		const theAST = queue.shift();
		const children = theAST.flatMap(convertWithIndentation(''));
		const template = new asm.TemplateFunc([new asm.DynamicBlock(children)]);
		templates.set(theAST, template);
	}

	for (const [theAST, template] of templates) {
		for (const include of includes.get(theAST)) {
			include.ref = template;
		}
	}

	return templates.get(rootAST);

	function convertWithIndentation(indentation) {
		return function convert(node) {
			if (node instanceof ast.LineNode) {
				const children = node.children.flatMap(
					convertWithIndentation(indentation + node.indentation)
				);
				if (!node.isNewline) return children;
				return new asm.DynamicNewline(node.source.string(), children);
			}
			if (node instanceof ast.LiteralNode) {
				const child = new asm.PrintLiteral(node.source.string());
				if (!indentation) return child;
				return new asm.DynamicIndentation(indentation, [child]);
			}
			if (node instanceof ast.ExpressionNode) {
				const js = new asm.JSFunc(node.js.source, node.js.dependencyNames);
				if (node.type === 'effect') {
					return new asm.Effect(node.js);
				} else {
					const child = new asm.PrintExpression(js, node.type === 'inject');
					if (!indentation) return child;
					return new asm.DynamicIndentation(indentation, [child]);
				}
			}
			if (node instanceof ast.LetNode) {
				const js = new asm.JSFunc(node.js.source, node.js.dependencyNames);
				const children = node.children.flatMap(convert);
				return new asm.LetBlock(js, node.name, [new asm.DynamicBlock(children)]);
			}
			if (node instanceof ast.IfNode) {
				const js = new asm.JSFunc(node.js.source, node.js.dependencyNames);
				const trueBranch = node.trueBranch.flatMap(convert);
				const falseBranch = node.falseBranch.flatMap(convert);
				return new asm.IfBlock(js, [new asm.DynamicBlock(trueBranch)], [new asm.DynamicBlock(falseBranch)]);
			}
			if (node instanceof ast.EachNode) {
				const js = new asm.JSFunc(node.js.source, node.js.dependencyNames);
				const trueBranch = node.trueBranch.flatMap(convert);
				const falseBranch = node.falseBranch.flatMap(convert);
				return new asm.EachBlock(js, [new asm.DynamicBlock(trueBranch)], [new asm.DynamicBlock(falseBranch)], node.name, node.indexName, node.lineSeparator);
			}
			if (node instanceof ast.TransformNode) {
				const js = new asm.JSFunc(node.js.source, node.js.dependencyNames);
				const children = node.children.flatMap(convert);
				const block = new asm.TransformBlock(js, [new asm.DynamicBlock(children)]);
				if (!indentation) return block;
				return new asm.DynamicIndentation(indentation, [block]);
			}
			if (node instanceof ast.IncludeNode) {
				const bindings = new Map();
				for (const binding of node.bindings) {
					const js = new asm.JSFunc(binding.js.source, binding.js.dependencyNames);
					bindings.set(binding.name, js);
				}

				if (recursiveASTs.has(node.ref)) {
					const convertSection = convertWithIndentation('');
					const sections = new Map();
					for (const section of node.sections) {
						const children = section.children.flatMap(convertSection);
						sections.set(section.name, [new asm.DynamicBlock(children)]);
					}

					const include = new asm.DynamicInclude(bindings, sections);
					const includeList = includes.get(node.ref);
					if (includeList) {
						includeList.push(include);
					} else {
						includes.set(node.ref, [include]);
						queue.push(node.ref);
					}

					if (!indentation) return include;
					return new asm.DynamicIndentation(indentation, [include]);
				} else {
					inlineStack.push(node.sections);
					const children = node.ref.flatMap(convert);
					inlineStack.pop();
					return new asm.InlineInclude(bindings, [new asm.DynamicBlock(children)]);
				}
			}
			if (node instanceof ast.SlotNode) {
				const inlineSections = inlineStack[inlineStack.length - 1];
				if (inlineSections) {
					const section = inlineSections.find(x => x.name === node.name);
					if (!section) return [];
					const children = section.children.flatMap(convert);
					return new asm.InlineSlot(node.name, [new asm.DynamicBlock(children)]);
				} else {
					const child = new asm.DynamicSlot(node.name);
					if (!indentation) return child;
					return new asm.DynamicIndentation(indentation, [child]);
				}
			}
			if (node instanceof ast.SectionNode) {
				return [];
			}
			throw new TypeError('Unrecognized AST node');
		};
	}
};

function findRecursiveASTs(rootAST) {
	const recursive = new Set();

	(function walkAST(theAST, visited) {
		visited.add(theAST);

		(function walk(nodes) {
			for (const node of nodes) {
				if (node instanceof ast.IncludeNode) {
					if (!recursive.has(node.ref)) {
						if (visited.has(node.ref)) {
							recursive.add(node.ref);
						} else {
							walkAST(node.ref, new Set(visited));
						}
					}
				}
				walk(node.children);
			}
		})(theAST);
	})(rootAST, new Set());

	return recursive;
}
