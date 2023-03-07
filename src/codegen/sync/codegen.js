'use strict';
const { ast } = require('../../parser');

/*
	Here we define the code generated for a compiled template.
 */

exports.node = new Map([
	[ast.LiteralNode, (node, ctx) => {
		const json = JSON.stringify(node.source.string());
		return `const ${ctx.name(node)} = () => write(${json});\n`;
	}],
	[ast.ExpressionNode, (node, ctx) => {
		if (node.type === 'normal') {
			return `const ${ctx.name(node)} = (scope) => write(escape(check(${ctx.name(node.js)}(scope))));\n`;
		}
		if (node.type === 'effect') {
			return `const ${ctx.name(node)} = (scope) => void ${ctx.name(node.js)}(scope);\n`;
		}
		if (node.type === 'inject') {
			return `const ${ctx.name(node)} = (scope) => write(check(${ctx.name(node.js)}(scope)));\n`;
		}
		throw new TypeError('Unrecognized expression type');
	}],
	[ast.LetNode, (node, ctx) => {
		if (node.js) {
			return (
				`const ${ctx.name(node)} = (scope) => {\n\t`
					+ `scope = scope.with('${node.name}', ${ctx.name(node.js)}(scope));\n`
					+ node.children.map(child => `\t${ctx.name(child)}(scope);\n`).join('')
				+ '};\n'
			);
		} else {
			return (
				`const ${ctx.name(node)} = (scope) => {\n\t`
					+ `scope = scope.with('${node.name}', scope.ctx.bindings.get('${node.name}'));\n`
					+ node.children.map(child => `\t${ctx.name(child)}(scope);\n`).join('')
				+ '};\n'
			);
		}
	}],
	[ast.IfNode, (node, ctx) => {
		return (
			`const ${ctx.name(node)} = (scope) => {\n\t`
				+ `if (${ctx.name(node.js)}(scope)) {\n\t`
					+ node.trueBranch.map(child => `\t${ctx.name(child)}(scope);\n\t`).join('')
				+ '} else {\n\t'
					+ node.falseBranch.map(child => `\t${ctx.name(child)}(scope);\n\t`).join('')
				+ '}\n'
			+ '};\n'
		);
	}],
	[ast.EachNode, (node, ctx) => {
		if (node.indexName) {
			return (
				`const ${ctx.name(node)} = (scope) => {\n\t`
					+ 'let index = 0;\n\t'
					+ `for (const element of ${ctx.name(node.js)}(scope)) {\n\t\t`
						+ `const newScope = scope.withTwo('${node.name}', element, '${node.indexName}', index++);\n\t`
						+ node.children.map(child => `\t${ctx.name(child)}(newScope);\n\t`).join('')
					+ '}\n'
				+ '};\n'
			);
		} else {
			return (
				`const ${ctx.name(node)} = (scope) => {\n\t`
					+ `for (const element of ${ctx.name(node.js)}(scope)) {\n\t\t`
						+ `const newScope = scope.with('${node.name}', element);\n\t`
						+ node.children.map(child => `\t${ctx.name(child)}(newScope);\n\t`).join('')
					+ '}\n'
				+ '};\n'
			);
		}
	}],
	[ast.TransformNode, (node, ctx) => {
		return (
			`const ${ctx.name(node)} = (scope) => {\n\t`
				+ 'const originalWrite = write;\n\t'
				+ 'const blockParts = [];\n\t'
				+ 'write = (str) => void blockParts.push(str);\n\t'
				+ node.children.map(child => `${ctx.name(child)}(scope);\n\t`).join('')
				+ 'write = originalWrite;\n\t'
				+ 'scope = scope.with(\'__block\', blockParts.join(\'\'));\n\t'
				+ `write(check(${ctx.name(node.js)}(scope)));\n`
			+ '};\n'
		);
	}],
	[ast.IncludeNode, (node, ctx) => {
		return (
			`const ${ctx.name(node)} = (scope) => {\n\t`
				+ 'const bindings = new Map();\n\t'
				+ node.bindings.map(binding => `bindings.set('${binding.name}', ${ctx.name(binding.js)}(scope));\n\t`).join('')
				+ 'const sections = new Map();\n\t'
				+ node.sections.map(section => `sections.set('${section.name}', ${ctx.name(section)});\n\t`).join('')
				+ 'const includeContext = { bindings, sections, scope, memo: new Map() };\n\t'
				+ 'const newScope = new Scope(includeContext);\n'
				+ node.ref.map(refNode => `\t${ctx.name(refNode)}(newScope);\n`).join('')
			+ '};\n'
		);
	}],
	[ast.SlotNode, (node, ctx) => {
		return (
			`const ${ctx.name(node)} = (scope) => {\n\t`
				+ `const fn = scope.ctx.sections.get('${node.name}');\n\t`
				+ 'if (fn) fn(scope.ctx.scope, scope.ctx.memo);\n'
			+ '};\n'
		);
	}],
	[ast.SectionNode, (node, ctx) => {
		return (
			`const ${ctx.name(node)} = (scope, memo) => {\n\t`
				+ `const cached = memo.get('${node.name}');\n\t`
				+ 'if (cached !== undefined) {\n\t\t'
					+ 'write(cached);\n\t\t'
					+ 'return;\n\t'
				+ '}\n\t'
				+ 'const originalWrite = write;\n\t'
				+ 'const blockParts = [];\n\t'
				+ 'write = (str) => { originalWrite(str); blockParts.push(str); };\n\t'
				+ node.children.filter(notSection).map(child => `${ctx.name(child)}(scope);\n\t`).join('')
				+ 'write = originalWrite;\n\t'
				+ `memo.set('${node.name}', blockParts.join(''));\n`
			+ '};\n'
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
	if (js.names.size) {
		return (
			`const ${ctx.name(js)} = ({ vars: { ${[...js.names].join(', ')} } }) => (\n\t`
				+ `${js.source.string()}\n`
			+ ');\n'
		);
	} else {
		return (
			`const ${ctx.name(js)} = () => (\n\t`
				+ `${js.source.string()}\n`
			+ ');\n'
		);
	}
};

exports.STRICT = '\'use strict\';\n';
exports.WRITE = 'let write;\n';

exports.CHECK = (
	'const check = (value) => {\n\t'
		+ 'if (typeof value === \'string\') return value;\n\t'
		+ 'if (typeof value === \'number\') {\n\t\t'
			+ 'if (value === value) return String(value);\n\t\t'
			+ 'throw new TypeError(\'Template expression returned NaN\');\n\t'
		+ '}\n\t'
		+ 'if (typeof value === \'bigint\') return String(value);\n\t'
		+ 'throw new TypeError(`Template expression returned an invalid type: ${typeof value}`);\n'
	+ '};\n'
);

exports.ESCAPE = (
	'const escape = (str) => str.replace(/[&<>"\']/g, escapeReplacer);\n'
	+ 'const escapeReplacer = (match) => {\n\t'
		+ 'switch (match) {\n\t\t'
			+ 'case \'&\': return \'&amp;\';\n\t\t'
			+ 'case \'<\': return \'&lt;\';\n\t\t'
			+ 'case \'>\': return \'&gt;\';\n\t\t'
			+ 'case \'"\': return \'&quot;\';\n\t\t'
			+ 'case \'\\\'\': return \'&#x27;\';\n\t\t'
			+ 'default: return match;\n\t'
		+ '}\n'
	+ '};\n'
);

exports.SCOPE = (
	'class Scope {\n\t'
		+ 'constructor(ctx) {\n\t\t'
			+ 'this.ctx = ctx;\n\t\t'
			+ 'this.vars = Object.create(null);\n\t'
		+ '}\n\t'
		+ 'with(name, value) {\n\t\t'
			+ 'const scope = new Scope(this.ctx);\n\t\t'
			+ 'Object.assign(scope.vars, this.vars);\n\t\t'
			+ 'scope.vars[name] = value;\n\t\t'
			+ 'return scope;\n\t'
		+ '}\n\t'
		+ 'withTwo(name1, value1, name2, value2) {\n\t\t'
			+ 'const scope = new Scope(this.ctx);\n\t\t'
			+ 'Object.assign(scope.vars, this.vars);\n\t\t'
			+ 'scope.vars[name1] = value1;\n\t\t'
			+ 'scope.vars[name2] = value2;\n\t\t'
			+ 'return scope;\n\t'
		+ '}\n'
	+ '}\n'
);

exports.INITIAL_SCOPE = (
	'const initialScope = new Scope({ bindings: null, sections: new Map(), scope: null, memo: null });\n'
);

function notSection(node) {
	return !(node instanceof ast.SectionNode);
}
