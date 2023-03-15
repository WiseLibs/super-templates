'use strict';
const { ast } = require('../../parser');

/*
	Here we define the code generated for a compiled template.
 */

exports.node = new Map([
	[ast.LineNode, (node, ctx) => {
		return (
			`function* ${ctx.name(node)}(scope, state, blockState) {\n`
				+ '\tlet isFirst = true;\n'
				+ `\tfor (const str of ${ctx.name(node)}_children(scope, state)) {\n`
					+ '\t\tif (!isNewline(str)) {\n'
						+ '\t\t\tif (isFirst) {\n'
							+ (node.isNewline
								? `\t\t\t\tif (blockState.needSeparator) yield ${JSON.stringify(node.source.string())};\n`
								+ '\t\t\t\telse yield "";\n'
								: '\t\t\t\tyield "";\n'
							)
						+ '\t\t\t}\n'
						+ (node.indentation
							? `\t\t\tif (str && state.atNewline) yield ${JSON.stringify(node.indentation)};\n`
							: ''
						)
						+ '\t\t\tisFirst = false;\n'
						+ '\t\t\tblockState.needSeparator = true;\n'
					+ '\t\t}\n'
					+ '\t\tyield str;\n'
				+ '\t}\n'
			+ '}\n'
			+ `function* ${ctx.name(node)}_children(scope, state) {\n`
				+ childrenOf(node).map(child => `\tyield* ${ctx.name(child)}(scope, state);\n`).join('')
			+ '}\n'
		);
	}],
	[ast.LiteralNode, (node, ctx) => {
		return (
			`function* ${ctx.name(node)}() {\n`
				+ `\tyield ${JSON.stringify(node.source.string())};\n`
			+ '}\n'
		);
	}],
	[ast.ExpressionNode, (node, ctx) => {
		if (node.type === 'normal') {
			return (
				`function* ${ctx.name(node)}(scope) {\n`
					+ `\tyield* normalize(${ctx.name(node.js)}(scope));\n`
				+ '}\n'
			);
		}
		if (node.type === 'inject') {
			return (
				`function* ${ctx.name(node)}(scope) {\n`
					+ `\tyield* normalize(${ctx.name(node.js)}(scope), true);\n`
				+ '}\n'
			);
		}
		if (node.type === 'effect') {
			return (
				`function* ${ctx.name(node)}(scope) {\n`
					+ `\t${ctx.name(node.js)}(scope);\n`
				+ '}\n'
			);
		}
		throw new TypeError('Unrecognized expression type');
	}],
	[ast.LetNode, (node, ctx) => {
		const value = node.js
			? `${ctx.name(node.js)}(scope)`
			: `scope.ctx.bindings.get("${node.name}")`;

		return (
			`function* ${ctx.name(node)}(scope, state) {\n`
				+ `\tconst newScope = scope.with("${node.name}", ${value});\n`
				+ `\tyield* ${ctx.name(node.children)}(newScope, state);\n`
			+ '}\n'
			+ blockContent(node.children, ctx)
		);
	}],
	[ast.IfNode, (node, ctx) => {
		if (node.falseBranch.length) {
			return (
				`function* ${ctx.name(node)}(scope, state) {\n`
					+ `\tif (${ctx.name(node.js)}(scope)) {\n`
						+ `\t\tyield* ${ctx.name(node.trueBranch)}(scope, state);\n`
					+ '\t} else {\n'
						+ `\t\tyield* ${ctx.name(node.falseBranch)}(scope, state);\n`
					+ '\t}\n'
				+ '}\n'
				+ blockContent(node.trueBranch, ctx)
				+ blockContent(node.falseBranch, ctx)
			);
		} else {
			return (
				`function* ${ctx.name(node)}(scope, state) {\n`
					+ `\tif (${ctx.name(node.js)}(scope)) {\n`
						+ `\t\tyield* ${ctx.name(node.trueBranch)}(scope, state);\n`
					+ '\t}\n'
				+ '}\n'
				+ blockContent(node.trueBranch, ctx)
			);
		}
	}],
	[ast.EachNode, (node, ctx) => {
		if (node.lineSeparator) {
			return (
				`function* ${ctx.name(node)}(scope, state) {\n`
					+ '\tlet needSeparator = false;\n'
					+ (node.indexName || node.falseBranch.length
						? '\tlet index = 0;\n'
						: ''
					)
					+ `\tfor (const element of ${ctx.name(node.js)}(scope)) {\n`
						+ (node.indexName
							? `\t\tconst newScope = scope.withTwo("${node.name}", element, "${node.indexName}", index);\n`
							: `\t\tconst newScope = scope.with("${node.name}", element);\n`
						)
						+ (node.indexName || node.falseBranch.length
							? '\t\tindex += 1;\n'
							: ''
						)
						+ '\t\tlet isFirst = true;\n'
						+ `\t\tfor (const str of ${ctx.name(node.trueBranch)}(newScope, state)) {\n`
							+ '\t\t\tif (!isNewline(str)) {\n'
								+ `\t\t\t\tif (isFirst && needSeparator) yield ${JSON.stringify(node.lineSeparator)};\n`
								+ '\t\t\t\tisFirst = false;\n'
								+ '\t\t\t\tneedSeparator = true;\n'
							+ '\t\t\t}\n'
							+ '\t\t\tyield str;\n'
						+ '\t\t}\n'
					+ '\t}\n'
					+ (node.falseBranch.length
						? `\tif (index === 0) yield* ${ctx.name(node.falseBranch)}(scope, state);\n`
						: ''
					)
				+ '}\n'
				+ blockContent(node.trueBranch, ctx)
				+ (node.falseBranch.length
					? blockContent(node.falseBranch, ctx)
					: ''
				)
			);
		} else {
			return (
				`function* ${ctx.name(node)}(scope, state) {\n`
					+ (node.indexName || node.falseBranch.length
						? '\tlet index = 0;\n'
						: ''
					)
					+ `\tfor (const element of ${ctx.name(node.js)}(scope)) {\n`
						+ (node.indexName
							? `\t\tconst newScope = scope.withTwo("${node.name}", element, "${node.indexName}", index);\n`
							: `\t\tconst newScope = scope.with("${node.name}", element);\n`
						)
						+ (node.indexName || node.falseBranch.length
							? '\t\tindex += 1;\n'
							: ''
						)
						+ `\t\tyield* ${ctx.name(node.trueBranch)}(newScope, state);\n`
					+ '\t}\n'
					+ (node.falseBranch.length
						? `\tif (index === 0) yield* ${ctx.name(node.falseBranch)}(scope, state);\n`
						: ''
					)
				+ '}\n'
				+ blockContent(node.trueBranch, ctx)
				+ (node.falseBranch.length
					? blockContent(node.falseBranch, ctx)
					: ''
				)
			);
		}
	}],
	[ast.TransformNode, (node, ctx) => {
		return (
			`function* ${ctx.name(node)}(scope) {\n`
				+ '\tconst state = { atNewline: true };\n'
				+ `\tconst blockParts = [...driveState(${ctx.name(node.children)}(scope, state), state)];\n`
				+ '\tconst newScope = scope.with("__block", blockParts.join(""));\n'
				+ `\tyield* normalize(${ctx.name(node.js)}(newScope), true);\n`
			+ '}\n'
			+ blockContent(node.children, ctx)
		);
	}],
	[ast.IncludeNode, (node, ctx) => {
		return (
			`function* ${ctx.name(node)}(scope, state) {\n`
				+ '\tconst bindings = new Map();\n'
				+ node.bindings.map(binding => `\tbindings.set("${binding.name}", ${ctx.name(binding.js)}(scope));\n`).join('')
				+ '\tconst sections = new Map();\n'
				+ node.sections.map(section => `\tsections.set("${section.name}", ${ctx.name(section)});\n`).join('')
				+ '\tconst includeContext = { bindings, sections, scope, memo: new Map() };\n'
				+ '\tconst newScope = new Scope(includeContext);\n'
				+ `\tyield* ${ctx.name(node.ref)}(newScope, state);\n`
			+ '}\n'
		);
	}],
	[ast.SlotNode, (node, ctx) => {
		return (
			`function* ${ctx.name(node)}(scope, state) {\n`
				+ `\tconst fn = scope.ctx.sections.get("${node.name}");\n`
				+ '\tif (fn) yield* fn(scope.ctx.scope, state, scope.ctx.memo);\n'
			+ '}\n'
		);
	}],
	[ast.SectionNode, (node, ctx) => {
		// TODO: this caching isn't correct, since it also caches the "state".
		//   instead, we need to render the section again, but cache all nested
		//   JS values. Although, that might not work for EachNodes...
		return (
			`function* ${ctx.name(node)}(scope, state, memo) {\n`
				+ `\tconst cached = memo.get("${node.name}");\n`
				+ '\tif (cached !== undefined) {\n'
					+ '\t\tyield* cached;\n'
					+ '\t\treturn;\n'
				+ '\t}\n'
				+ '\tconst blockParts = [];\n'
				+ `\tfor (const str of ${ctx.name(node.children)}(scope, state)) {\n`
					+ '\t\tblockParts.push(str);\n'
					+ '\t\tyield str;\n'
				+ '\t}\n'
				+ `\tmemo.set("${node.name}", blockParts);\n`
			+ '}\n'
			+ blockContent(node.children, ctx)
		);
	}],
]);

exports.js = (js, ctx) => {
	// TODO: for this to work, we need to make sure that all js.names are within
	// the scope at runtime. That means we need to know all allowed globals,
	// create vars via Object.create(globals), and throw compile-time errors when
	// JS code references an unknown name (not in scope or globals). However, since
	// we can get false positives when detecting JS names, we need to prevent all
	// expressions from containing functions or statements.
	// Alternatively, we could only provide the names that are in scope (which we
	// would have to calculate for each js instance), and generate all other names
	// such that they won't collide with any names within any JS expressions.
	// Therefore, references to globals would work implicitly, but we wouldn't be
	// able to catch reference errors at compile-time.
	if (js.names.size) {
		return (
			`const ${ctx.name(js)} = ({ vars: { ${[...js.names].join(', ')} } }) => (\n`
				+ `${js.source.string()}\n`
			+ ');\n'
		);
	} else {
		return (
			`const ${ctx.name(js)} = () => (\n`
				+ `${js.source.string()}\n`
			+ ');\n'
		);
	}
};

exports.ast = blockContent;

exports.root = (nodes, ctx) => {
	return (
		'function* driveState(iterator, state) {\n'
			+ '\tfor (const str of iterator) {\n'
				+ '\t\tif (!str) continue;\n'
				+ '\t\tstate.atNewline = isNewline(str);\n'
				+ '\t\tyield str;\n'
			+ '\t}\n'
		+ '}\n'
		+ 'return function* template() {\n'
			+ '\tconst scope = new Scope({ bindings: null, sections: new Map(), scope: null, memo: null });\n'
			+ '\tconst state = { atNewline: true };\n'
			+ `\tyield* driveState(${ctx.name(nodes)}(scope, state), state);\n`
		+ '};\n'
	);
};

function blockContent(nodes, ctx) {
	if (!nodes.every(node => node instanceof ast.LineNode)) {
		throw new TypeError('Expected each node within a block to be a LineNode');
	}
	return (
		`function* ${ctx.name(nodes)}(scope, state) {\n`
			+ '\tconst blockState = { needSeparator: false };\n'
			+ nodes.map(node => `\tyield* ${ctx.name(node)}(scope, state, blockState);\n`).join('')
		+ '}\n'
	);
}

function childrenOf(node) {
	return node.children.filter(child => !(child instanceof ast.SectionNode));
}
