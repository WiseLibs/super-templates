'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('recursive templates', function () {
	// TODO: basic recursive template
	// TODO: indentation in recursive template
});
