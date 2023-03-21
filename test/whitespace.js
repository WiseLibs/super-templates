'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('whitespace behavior', function () {
	// TODO: indentation
	// TODO: dynamic newlines
	// TODO: literal newlines
	// TODO: "each" block line separators
	// TODO: strip comment lines
	// TODO: collapse blocks
	// TODO: "transform" block isolated state
	// TODO: "include" block default section with nested named sections
	// TODO: trimmed whitespace within template preamble
});
