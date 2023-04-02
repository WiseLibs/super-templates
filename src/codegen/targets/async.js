'use strict';
const asm = require('../asm');

/*
	Here we define the code generated for asynchronous targets.
 */

exports.node = new Map([
	[asm.TemplateFunc, (node, ctx, render) => {
		const children = render(node.children);
		return (
			`function ${ctx.name(node)}(ctx) ` + block([
				'const scope = new AsyncScope();',
				'const { store, consume, clear } = createAsyncStorage();',
				prepare(children),
				'return async (write, state) => ' + block([
					'const ctx = undefined;',
					'const scope = undefined;',
					print(children),
					'await clear();',
				]),
			])
		);
	}],
	[asm.DynamicBlock, (node, ctx, render) => {
		const children = render(node.children);
		return {
			prepare: prepare(children),
			print: block([
				'const blockHasContent = state.blockHasContent;',
				'state.blockHasContent = false;',
				print(children),
				'if (blockHasContent) state.blockHasContent = true;',
			]),
		};
	}],
	[asm.DynamicNewline, (node, ctx, render) => {
		const children = render(node.children);
		return {
			prepare: prepare(children),
			print: block([
				'const blockHasContent = state.blockHasContent;',
				`if (blockHasContent) state.pendingNewline = ${JSON.stringify(node.newline)};`,
				print(children),
				'if (blockHasContent) state.pendingNewline = "";',
			]),
		};
	}],
	[asm.DynamicIndentation, (node, ctx, render) => {
		const children = render(node.children);
		return {
			prepare: prepare(children),
			print: block([
				'const indentation = state.indentation;',
				`state.indentation += ${JSON.stringify(node.indentation)};`,
				print(children),
				'state.indentation = indentation;',
			]),
		};
	}],
	[asm.PrintLiteral, (node, ctx) => {
		return {
			prepare: '',
			print: `write(${JSON.stringify(node.content)});`,
		};
	}],
	[asm.PrintExpression, (node, ctx) => {
		const location = JSON.stringify(ctx.location(node.js.source));
		const isRaw = node.isRaw ? 'true' : 'false';

		const value = node.js.dependencyNames.length
			? `scope.use(${deps(node.js)})\n`
				+ `\t.then(${ctx.name(node.js)})\n`
				+ `\t.then(value => normalize(value, ${location}, ${isRaw}))`
			: `${ctx.name(node.js)}()\n`
				+ `\t.then(value => normalize(value, ${location}, ${isRaw}))`;

		return {
			prepare: `store("${ctx.name(node)}", ${value});`,
			print: `write(await consume("${ctx.name(node)}"));`,
		};
	}],
	[asm.Effect, (node, ctx) => {
		const value = node.js.dependencyNames.length
			? `scope.use(${deps(node.js)}).then(${ctx.name(node.js)})`
			: `${ctx.name(node.js)}()`;

		return {
			prepare: `${value};`,
			print: '',
		};
	}],
	[asm.DynamicSlot, (node, ctx) => {
		return {
			prepare: block([
				`const prepare = ctx.sections.get("${node.name}");`,
				`if (prepare) store("${ctx.name(node)}", Promise.resolve(prepare()));`,
			]),
			print: block([
				`const print = consume("${ctx.name(node)}");`,
				'if (print) await (await print)(write, state);',
			]),
		};
	}],
	[asm.InlineSlot, (node, ctx, render) => {
		const children = render(node.children);
		return {
			prepare: block([
				'const scope = ctx.scope;',
				prepare(children),
			]),
			print: print(children),
		};
	}],
	[asm.DynamicInclude, (node, ctx, render) => {
		return {
			prepare: block([
				'const bindings = new Map();',
				...[...node.bindings].map(([name, js]) => {
					const getter = js.dependencyNames.length
						? `memo(() => scope.use(${deps(js)}).then(${ctx.name(js)}))`
						: `memo(${ctx.name(js)})`;

					return `bindings.set("${name}", ${getter});`;
				}),
				'const sections = new Map();',
				...[...node.sections].map(([name, section]) => {
					const sectionChildren = render(section);
					return (
						`sections.set("${name}", () => ` + block([
							'const { store, consume, clear } = createAsyncStorage();',
							prepare(sectionChildren),
							'return async (write, state) => ' + block([
								'const ctx = undefined;',
								'const scope = undefined;',
								print(sectionChildren),
								'await clear();',
							]) + ';',
						]) + ');'
					);
				}),
				`const print = ${ctx.name(node.ref)}({ bindings, sections });`,
				`store("${ctx.name(node)}", Promise.resolve(print));`,
			]),
			print: `await (await consume("${ctx.name(node)}"))(write, state);`,
		};
	}],
	[asm.InlineInclude, (node, ctx, render) => {
		const children = render(node.children);
		return {
			prepare: block([
				'const bindings = new Map();',
				...[...node.bindings].map(([name, js]) => {
					const getter = js.dependencyNames.length
						? `memo(() => scope.use(${deps(js)}).then(${ctx.name(js)}))`
						: `memo(${ctx.name(js)})`;

					return `bindings.set("${name}", ${getter});`;
				}),
				'const ctx = { bindings, scope };',
				block([
					'const scope = new AsyncScope();',
					prepare(children),
				]),
			]),
			print: print(children),
		};
	}],
	[asm.LetBlock, (node, ctx, render) => {
		const children = render(node.children);

		const getter = node.js
			? node.js.dependencyNames.length
				? `memo(() => oldScope.use(${deps(node.js)}).then(${ctx.name(node.js)}))`
				: `memo(${ctx.name(node.js)})`
			: `ctx.bindings.get("${node.name}")`;

		return {
			prepare: block([
				'const oldScope = scope;',
				block([
					`const scope = oldScope.with("${node.name}", ${getter});`,
					prepare(children),
				]),
			]),
			print: print(children),
		};
	}],
	[asm.IfBlock, (node, ctx, render) => {
		const trueBranch = render(node.trueBranch);
		const falseBranch = render(node.falseBranch);
		const prepareTrueBranch = prepare(trueBranch);
		const prepareFalseBranch = prepare(falseBranch);
		const printTrueBranch = print(trueBranch);
		const printFalseBranch = print(falseBranch);

		const condition = node.js.dependencyNames.length
			? `scope.use(${deps(node.js)}).then(${ctx.name(node.js)})`
			: `${ctx.name(node.js)}()`;

		let prepareBranches = '';
		if (prepareTrueBranch || prepareFalseBranch) {
			prepareBranches = `if (bool) ${block([prepareTrueBranch])}`;
			if (prepareFalseBranch) prepareBranches += ` else ${block([prepareFalseBranch])}`;
		}

		let printBranches = `if (await consume("${ctx.name(node)}")) ${block([printTrueBranch])}`;
		if (printFalseBranch) printBranches += ` else ${block([printFalseBranch])}`;

		return {
			prepare: prepareBranches
				? (
					`store("${ctx.name(node)}", ${condition}.then((bool) => ` + block([
						prepareBranches,
						'return !!bool;',
					]) + '));'
				)
				: (
					`store("${ctx.name(node)}", ${condition});`
				),
			print: printBranches,
		};
	}],
	[asm.EachBlock, (node, ctx, render) => {
		const trueBranch = render(node.trueBranch);
		const falseBranch = render(node.falseBranch);
		const prepareTrueBranch = prepare(trueBranch);
		const prepareFalseBranch = prepare(falseBranch);
		const printTrueBranch = print(trueBranch);
		const printFalseBranch = print(falseBranch);

		const iterable = node.js.dependencyNames.length
			? `oldScope.use(${deps(node.js)}).then(${ctx.name(node.js)})`
			: `${ctx.name(node.js)}()`;

		const needsIndex = !!(prepareTrueBranch && node.indexName || prepareFalseBranch);
		const needsOldScope = !!(prepareTrueBranch || node.js.dependencyNames.length);

		return {
			prepare: (
				`store("${ctx.name(node)}", Promise.resolve(createAsyncIterable(async (output) => ` + block([
					ifThen(needsOldScope, [
						'const oldScope = scope;',
					]),
					ifThen(needsIndex, [
						'let index = 0;',
					]),
					`for await (const element of await ${iterable}) ` + block([
						ifThen(prepareTrueBranch, [
							ifThen(node.indexName, [
								'const currentIndex = index;',
								`const scope = oldScope.withTwo("${node.name}", async () => element, "${node.indexName}", async () => currentIndex);`,
							], [
								`const scope = oldScope.with("${node.name}", async () => element);`,
							]),
							ifThen(needsIndex, [
								'index += 1;',
							]),
							'const storage = createAsyncStorage();',
							'const { store, consume, clear } = storage;',
							prepareTrueBranch,
							'output(storage);',
						], [
							ifThen(needsIndex, [
								'index += 1;',
							]),
							'output(createAsyncStorage());',
						]),
					]),
					ifThen(prepareFalseBranch, [
						`if (index === 0) ${block([prepareFalseBranch])}`,
					]),
				]) + ')));'
			),
			print: block([
				ifThen(node.lineSeparator, [
					'const blockHasContent = state.blockHasContent;',
					'state.blockHasContent = false;',
				]),
				ifThen(printFalseBranch, [
					'let isEmpty = true;',
				]),
				`for await (const storage of await consume("${ctx.name(node)}")) ` + block([
					ifThen(printFalseBranch, [
						'isEmpty = false;',
					]),
					ifThen(node.lineSeparator, [
						'const blockHasContent = state.blockHasContent;',
						`if (blockHasContent) state.pendingNewline = ${JSON.stringify(node.lineSeparator)};`,
					]),
					'const { store, consume, clear } = storage;',
					printTrueBranch,
					ifThen(node.lineSeparator, [
						'if (blockHasContent) state.pendingNewline = "";',
					]),
					'await clear();',
				]),
				ifThen(node.lineSeparator, [
					'if (blockHasContent) state.blockHasContent = true;',
				]),
				ifThen(printFalseBranch, [
					`if (isEmpty) ${block([printFalseBranch])}`,
				]),
			]),
		};
	}],
	[asm.TransformBlock, (node, ctx, render) => {
		const children = render(node.children);
		const location = JSON.stringify(ctx.location(node.js.source));

		const value = `newScope.use(${deps(node.js)})\n`
			+ `\t.then(${ctx.name(node.js)})\n`
			+ `\t.then(value => normalize(value, ${location}, true))`;

		return {
			prepare: block([
				prepare(children),
				`store("${ctx.name(node)}", (async () => ` + block([
					'const output = [];',
					block([
						'const ctx = undefined;',
						'const scope = undefined;',
						'const state = { atNewline: true, blockHasContent: false, pendingNewline: "", indentation: "" };',
						'const write = createWriter(output.push.bind(output), state);',
						print(children),
					]),
					'const blockContent = output.join("");',
					'const newScope = scope.with("__block", async () => blockContent);',
					`return ${value};`,
				]) + ')());',
			]),
			print: `write(await consume("${ctx.name(node)}"));`,
		};
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
				const params = js.dependencyNames.length ? `const { ${js.dependencyNames.join(', ')} } = arguments[0]; ` : '';
				const body = JSON.stringify(js.source.string());
				return `\t\t+ \`\\t{ loc: \${${location}}, async exec() { ${params}return (\\n\${${body}}\\n\\t); } },\\n\`\n`
			}).join('')
			+ '\t+ "];"\n'
		+ ')(helpers).map(({ exec, loc }) => traceAsync(exec, loc));'
	);
};

exports.root = (rootTemplate, ctx) => {
	let parameterNames = '';
	let location = '';

	if (rootTemplate.parameters.names.size) {
		parameterNames = `const parameterNames = [${[...rootTemplate.parameters.names].map(x => `"${x}"`).join(', ')}];\n`;
		location = JSON.stringify(rootTemplate.parameters.filename);
	}

	return (
		parameterNames + 'return function template(parameters) ' + block([
			'return createAsyncIterable(async (output) => ' + block([
				ifThen(parameterNames, [
					`const bindingValues = getParameters(parameters, parameterNames, ${location});`,
					'const bindings = new Map([...bindingValues].map(([k, v]) => [k, (async () => v)]));',
				], [
					'const bindings = new Map();',
				]),
				`const print = ${ctx.name(rootTemplate)}({ bindings, sections: new Map() });`,
				'const state = { atNewline: true, blockHasContent: false, pendingNewline: "", indentation: "" };',
				'const write = createWriter(output, state);',
				'await print(write, state);',
			]) + ');',
		]) + ';'
	);
};

function ifThen(condition, ifTrue, ifFalse = []) {
	return (condition ? ifTrue : ifFalse).filter(x => x).join('\n');
}

function block(lines) {
	lines = lines.filter(x => x);
	if (!lines.length) return '{}';
	return `{\n\t${lines.join('\n').replace(/\n(?!$|\n)/g, '\n\t')}\n}`;
}

function prepare(renderedNodes) {
	return renderedNodes.map(x => x.prepare).filter(x => x).join('\n');
}

function print(renderedNodes) {
	return renderedNodes.map(x => x.print).filter(x => x).join('\n');
}

function deps(js) {
	return js.dependencyNames.map(x => `"${x}"`).join(', ');
}
