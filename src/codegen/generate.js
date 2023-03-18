'use strict';
const CodegenContext = require('./context');
const computeDependencies = require('./compute-dependencies');
const assemble = require('./assemble');
const optimize = require('./optimize');
const asm = require('./asm');

/*
	Generates the code for a given template AST.
 */

module.exports = (rootAST) => {
	if (!Array.isArray(rootAST)) {
		throw new TypeError('Expected rootAST to be an array');
	}

	computeDependencies(rootAST);

	const rootTemplate = optimize(assemble(rootAST));
	const visited = new Set([rootTemplate]);
	const ctx = new CodegenContext();
	const code = ['"use strict";\n'];
	const jsFuncs = [];
	const queue = [rootTemplate];

	while (queue.length) {
		for (const str of gen(queue.shift())) {
			code.push(str);
			code.push('\n');
		}
	}

	while (jsFuncs.length) {
		code.push(genJS(jsFuncs.shift()));
	}

	code.push(genStart());
	return code.join('');

	function* indent(iterator) {
		for (const str of iterator) {
			yield `\t${str}`;
		}
	}

	function* genAll(nodes) {
		for (const node of nodes) {
			yield* gen(node);
		}
	}

	function* gen(node) {
		if (node instanceof asm.DynamicBlock) {
			yield '{';
			yield '\tconst blockHasContent = state.blockHasContent;';
			yield '\tstate.blockHasContent = false;';
			yield* indent(genAll(node.children));
			yield '\tif (blockHasContent) state.blockHasContent = true;';
			yield '}';
		} else if (node instanceof asm.DynamicNewline) {
			yield '{';
			yield '\tconst blockHasContent = state.blockHasContent;';
			yield `\tif (blockHasContent) state.pendingNewline = ${JSON.stringify(node.newline)};`;
			yield* indent(genAll(node.children));
			yield '\tif (blockHasContent) state.pendingNewline = "";';
			yield '}';
		} else if (node instanceof asm.DynamicIndentation) {
			yield '{';
			yield '\tconst originalIndentation = state.indentation;';
			yield '\tconst originalIndenter = state.indenter;';
			yield `\tstate.indentation = ${JSON.stringify(node.indentation)};`;
			yield `\tstate.indenter = ${JSON.stringify('$&' + node.indentation)};`;
			yield* indent(genAll(node.children));
			yield '\tstate.indentation = originalIndentation;';
			yield '\tstate.indenter = originalIndenter;';
			yield '}';
		} else if (node instanceof asm.PrintLiteral) {
			yield `write(${JSON.stringify(node.content)});`;
		} else if (node instanceof asm.PrintExpression) {
			yield `write(normalize(${ctx.name(node.js)}(scope), ${JSON.stringify(ctx.location(node.js.source))}, ${node.isRaw ? 'true' : 'false'}));`;
			jsFuncs.push(node.js);
		} else if (node instanceof asm.Effect) {
			yield `${ctx.name(node.js)}(scope);`;
			jsFuncs.push(node.js);
		} else if (node instanceof asm.DynamicSlot) {
			yield `temp = ctx.sections.get("${node.name}");`
			yield 'if (temp) temp(write, state);';
		} else if (node instanceof asm.InlineSlot) {
			yield '{';
			yield '\tconst scope = ctx.scope;';
			yield* indent(genAll(node.children));
			yield '}';
		} else if (node instanceof asm.DynamicInclude) {
			yield '{';
			yield '\tconst bindings = new Map();';
			for (const [name, js] of node.bindings) {
				yield `\tbindings.set("${name}", ${ctx.name(js)}(scope));`;
				jsFuncs.push(js);
			}
			yield '\tconst sections = new Map();';
			for (const [name, section] of node.sections) {
				yield `\tsections.set("${name}", (write, state) => {`;
				yield* indent(indent(genAll(section)));
				yield '\t});';
			}
			yield `\t${ctx.name(node.ref)}(write, state, { bindings, sections });`;
			yield '}';
			if (!visited.has(node.ref)) {
				visited.add(node.ref);
				queue.push(node.ref);
			}
		} else if (node instanceof asm.InlineInclude) {
			yield '{';
			yield '\tconst bindings = new Map();';
			for (const [name, js] of node.bindings) {
				yield `\tbindings.set("${name}", ${ctx.name(js)}(scope));`;
				jsFuncs.push(js);
			}
			yield '\ttemp = scope;'
			yield '\t{'
			yield '\t\tconst ctx = { bindings, scope: temp };';
			yield '\t\tconst scope = new Scope();';
			yield* indent(indent(genAll(node.children)));
			yield '\t}'
			yield '}';
		} else if (node instanceof asm.LetBlock) {
			yield 'temp = scope;';
			yield '{';
			if (node.js) {
				yield `\tconst scope = temp.with("${node.name}", ${ctx.name(node.js)}(temp));`;
				jsFuncs.push(node.js);
			} else {
				yield `\tconst scope = temp.with("${node.name}", ctx.bindings.get("${node.name}"));`;
			}
			yield* indent(genAll(node.children));
			yield '}';
		} else if (node instanceof asm.IfBlock) {
			yield `if (${ctx.name(node.js)}(scope)) {`;
			yield* indent(genAll(node.trueBranch));
			if (node.falseBranch.length) {
				yield '} else {';
				yield* indent(genAll(node.falseBranch));
			}
			yield '}';
			jsFuncs.push(node.js);
		} else if (node instanceof asm.EachBlock) {
			// TODO
			// throw new TypeError('EachBlock unimplemented');
		} else if (node instanceof asm.TransformBlock) {
			// TODO
			// throw new TypeError('TransformBlock unimplemented');
		} else if (node instanceof asm.TemplateFunc) {
			yield `function ${ctx.name(node)}(write, state, ctx) {`;
			yield '\tconst scope = new Scope();';
			yield '\tlet temp;';
			yield* indent(genAll(node.children));
			yield '}';
		} else {
			throw new TypeError('Unrecognized ASM node');
		}
	}

	function genJS(js) {
		const location = JSON.stringify(ctx.location(js.source));
		const body = JSON.stringify(js.source.string());
		const params = js.dependencyNames.length
			? JSON.stringify(`{ vars: { ${js.dependencyNames.join(', ')} } }`) + ', '
			: '';
		return (
			`const ${ctx.name(js)} = trace(\n`
				+ `\tnew Function(${params}\`return (\\n\${${body}}\\n);\`)\n`
			+ `, ${location});\n`
		);
	}

	function genStart() {
		return (
			'return function template() {\n'
				+ '\tconst output = [];\n'
				+ '\tconst state = { atNewline: true, blockHasContent: false, pendingNewline: "", indentation: "", indenter: "$&" };\n'
				+ '\tconst write = createWriter(output, state);\n'
				+ `\t${ctx.name(rootTemplate)}(write, state, { bindings: null, sections: new Map() });\n`
				+ '\treturn output.join("");\n'
			+ '};\n'
		);
	}
};
