'use strict';
const CodegenContext = require('./context');
const computeDependencies = require('./compute-dependencies');
const assemble = require('./assemble');
const optimize = require('./optimize');
const asm = require('./asm');

/*
	Generates the code for a given template AST.
 */

module.exports = (rootAST, target) => {
	if (!Array.isArray(rootAST)) {
		throw new TypeError('Expected rootAST to be an array');
	}

	computeDependencies(rootAST);

	const rootTemplate = optimize(assemble(rootAST));
	const ctx = new CodegenContext();
	const render = (node) => target.node.get(node.constructor)(node, ctx, renderAll);
	const renderAll = (nodes) => nodes.map(render);
	const code = ['"use strict";'];
	const entryCode = target.root(rootTemplate, ctx);
	const jsFuncs = [];

	while (ctx.named.length) {
		const templateFuncs = ctx.named.filter(x => x instanceof asm.TemplateFunc);
		jsFuncs.push(...ctx.named.filter(x => x instanceof asm.JSFunc));
		ctx.named = [];

		for (const template of templateFuncs) {
			code.push(render(template));
			ctx.isRootTemplate = false;
		}
	}

	if (jsFuncs.length) {
		code.push(target.js(jsFuncs, ctx));
	}

	code.push(entryCode);
	return code.join('\n\n');
};
