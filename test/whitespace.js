'use strict';
const FT = require('../.');

async function createTemplate(content, options = { syncOnly: true }) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, options);
	return FT.create(compiledTemplate);
}

async function createAsyncTemplate(content) {
	const template = await createTemplate(content, { syncOnly: false });
	return async () => {
		const output = [];
		for await (const str of template()) output.push(str);
		return output.join('');
	};
}

describe('whitespace behavior', function () {
	describe('sync templates', function () {
		// TODO: indentation (also in included templates, sections, and recursive templates)
		// TODO: dynamic newlines
		// TODO: literal newlines
		// TODO: "each" block line separators
		// TODO: strip comment lines
		// TODO: collapse blocks
		// TODO: "transform" block isolated state
		// TODO: "include" block default section with nested named sections
		// TODO: trimmed whitespace within template preamble
	});
	describe('async templates', function () {
		// TODO: indentation (also in included templates, sections, and recursive templates)
		// TODO: dynamic newlines
		// TODO: literal newlines
		// TODO: "each" block line separators
		// TODO: strip comment lines
		// TODO: collapse blocks
		// TODO: "transform" block isolated state
		// TODO: "include" block default section with nested named sections
		// TODO: trimmed whitespace within template preamble
	});
});
