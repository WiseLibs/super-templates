'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('template validation', function () {
	// TODO: non-string-literal as include path
	// TODO: illegal "end" token
	// TODO: illegal "else" token
	// TODO: illegal "section" block
	// TODO: unterminated block
	// TODO: "each-else-if" chain
	// TODO: template parameters in root template
	// TODO: missing template parameters in "include"
	// TODO: duplicate template parameters in "include"
	// TODO: undefined template parameters in "include"
	// TODO: duplicate section in "include"
	// TODO: undefined section in "include"
	// TODO: "include" block with content but no default slot
});
