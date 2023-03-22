'use strict';
const asm = require('../asm');

/*
	Here we define the code generated for synchronous targets.
 */

exports.node = new Map([
	[asm.TemplateFunc, (node, ctx, render) => {
		return (
			`function ${ctx.name(node)}(write, state, ctx) ` + block([
				'const scope = new Scope();',
				...render(node.children),
			])
		);
	}],
	[asm.DynamicBlock, (node, ctx, render) => {
		return block([
			'const blockHasContent = state.blockHasContent;',
			'state.blockHasContent = false;',
			...render(node.children),
			'if (blockHasContent) state.blockHasContent = true;',
		]);
	}],
	[asm.DynamicNewline, (node, ctx, render) => {
		return block([
			'const blockHasContent = state.blockHasContent;',
			`if (blockHasContent) state.pendingNewline = ${JSON.stringify(node.newline)};`,
			...render(node.children),
			'if (blockHasContent) state.pendingNewline = "";',
		]);
	}],
	[asm.DynamicIndentation, (node, ctx, render) => {
		return block([
			'const indentation = state.indentation;',
			`state.indentation += ${JSON.stringify(node.indentation)};`,
			...render(node.children),
			'state.indentation = indentation;',
		]);
	}],
	[asm.PrintLiteral, (node, ctx) => {
		return `write(${JSON.stringify(node.content)});`;
	}],
	[asm.PrintExpression, (node, ctx) => {
		const location = JSON.stringify(ctx.location(node.js.source));
		const isRaw = node.isRaw ? 'true' : 'false';
		return `write(normalize(${ctx.name(node.js)}(scope.use()), ${location}, ${isRaw}));`;
	}],
	[asm.Effect, (node, ctx) => {
		return `${ctx.name(node.js)}(scope.use());`;
	}],
	[asm.DynamicSlot, (node, ctx) => {
		return block([
			`const fn = ctx.sections.get("${node.name}");`,
			'if (fn) fn(write, state);',
		]);
	}],
	[asm.InlineSlot, (node, ctx, render) => {
		return block([
			'const scope = ctx.scope;',
			...render(node.children),
		]);
	}],
	[asm.DynamicInclude, (node, ctx, render) => {
		return block([
			'const bindings = new Map();',
			...[...node.bindings].map(([name, js]) => (
				`bindings.set("${name}", ${ctx.name(js)}(scope.use()));`
			)),
			'const sections = new Map();',
			...[...node.sections].map(([name, section]) => (
				`sections.set("${name}", (write, state) => ${block(render(section))});`
			)),
			`${ctx.name(node.ref)}(write, state, { bindings, sections });`,
		]);
	}],
	[asm.InlineInclude, (node, ctx, render) => {
		return block([
			'const bindings = new Map();',
			...[...node.bindings].map(([name, js]) => (
				`bindings.set("${name}", ${ctx.name(js)}(scope.use()));`
			)),
			'const ctx = { bindings, scope };',
			block([
				'const scope = new Scope();',
				...render(node.children),
			]),
		]);
	}],
	[asm.LetBlock, (node, ctx, render) => {
		const value = node.js
			? `${ctx.name(node.js)}(oldScope.use())`
			: `ctx.bindings.get("${node.name}")`;

		return block([
			'const oldScope = scope;',
			block([
				`const scope = oldScope.with("${node.name}", ${value});`,
				...render(node.children),
			]),
		]);
	}],
	[asm.IfBlock, (node, ctx, render) => {
		let code = `if (${ctx.name(node.js)}(scope.use())) ${block(render(node.trueBranch))}`;

		if (node.falseBranch.length) {
			code += ` else ${block(render(node.falseBranch))}`;
		}

		return code;
	}],
	[asm.EachBlock, (node, ctx, render) => {
		if (node.lineSeparator) {
			return block([
				'const oldScope = scope;',
				'const blockHasContent = state.blockHasContent;',
				'state.blockHasContent = false;',
				...ifThen(node.indexName || node.falseBranch.length, [
					'let index = 0;',
				]),
				`for (const element of ${ctx.name(node.js)}(oldScope.use())) ` + block([
					...ifThen(node.indexName, [
						`const scope = oldScope.withTwo("${node.name}", element, "${node.indexName}", index);`,
					], [
						`const scope = oldScope.with("${node.name}", element);`,
					]),
					...ifThen(node.indexName || node.falseBranch.length, [
						'index += 1;',
					]),
					'const blockHasContent = state.blockHasContent;',
					`if (blockHasContent) state.pendingNewline = ${JSON.stringify(node.lineSeparator)};`,
					...render(node.trueBranch),
					'if (blockHasContent) state.pendingNewline = "";',
				]),
				'if (blockHasContent) state.blockHasContent = true;',
				...ifThen(node.falseBranch.length, [
					`if (index === 0) ${block(render(node.falseBranch))}`,
				]),
			]);
		} else {
			return block([
				'const oldScope = scope;',
				...ifThen(node.indexName || node.falseBranch.length, [
					'let index = 0;',
				]),
				`for (const element of ${ctx.name(node.js)}(oldScope.use())) ` + block([
					...ifThen(node.indexName, [
						`const scope = oldScope.withTwo("${node.name}", element, "${node.indexName}", index);`,
					], [
						`const scope = oldScope.with("${node.name}", element);`,
					]),
					...ifThen(node.indexName || node.falseBranch.length, [
						'index += 1;',
					]),
					...render(node.trueBranch),
				]),
				...ifThen(node.falseBranch.length, [
					`if (index === 0) ${block(render(node.falseBranch))}`,
				]),
			]);
		}
	}],
	[asm.TransformBlock, (node, ctx, render) => {
		const location = JSON.stringify(ctx.location(node.js.source));
		return block([
			'const output = [];',
			block([
				'const state = { atNewline: true, blockHasContent: false, pendingNewline: "", indentation: "" };',
				'const write = createWriter(output, state);',
				...render(node.children),
			]),
			'const newScope = scope.with("__block", output.join(""));',
			`write(normalize(${ctx.name(node.js)}(newScope.use()), ${location}, true));`,
		]);
	}],
]);

exports.js = (jsFuncs, ctx) => {
	return (
		'const [\n'
			+ jsFuncs.map(js => `\t${ctx.name(js)},\n`).join('')
		+ '] = new Function(\n'
			+ '\t"\\"use strict\\";\\n"\n'
			+ '\t+ `const { ${Object.keys(helpers).join(", ")} } = arguments[0];\\n`\n'
			+ '\t+ "return [\\n"\n'
			+ jsFuncs.map((js) => {
				const location = JSON.stringify(JSON.stringify(ctx.location(js.source)));
				const params = js.dependencyNames.length ? `{ ${js.dependencyNames.join(', ')} }` : '';
				const body = JSON.stringify(js.source.string());
				return `\t\t+ \`\\t{ loc: \${${location}}, exec(${params}) { return (\\n\${${body}}\\n\\t); } },\\n\`\n`
			}).join('')
			+ '\t+ "];"\n'
		+ ')(helpers).map(({ exec, loc }) => trace(exec, loc));'
	)
};

exports.root = (rootTemplate, ctx) => {
	return (
		'return function template() ' + block([
			'const output = [];',
			'const state = { atNewline: true, blockHasContent: false, pendingNewline: "", indentation: "" };',
			'const write = createWriter(output, state);',
			`${ctx.name(rootTemplate)}(write, state, { bindings: null, sections: new Map() });`,
			'return output.join("");',
		]) + ';'
	);
};

function ifThen(condition, ifTrue, ifFalse = []) {
	return condition ? ifTrue : ifFalse;
}

function block(lines) {
	if (!lines.length) return '{}';
	return `{\n\t${lines.join('\n').replace(/\n(?!$|\n)/g, '\n\t')}\n}`;
}
