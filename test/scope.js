'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('basic features', function () {
	it('provides access to the global scope');
	it('provides access to user-defined helpers');
	it('provides access to template variables');
	it('provides scopes that shadow over previous scopes');
	it('provides a "this" value of undefined');
});
