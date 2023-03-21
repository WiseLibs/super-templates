'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('misc features', function () {
	// TODO: unterminated "let" blocks in preamble
	// TODO: unterminated "include" blocks in preamble
});
