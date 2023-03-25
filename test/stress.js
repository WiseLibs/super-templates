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

describe('stress tests', function () {
	describe('sync templates', function () {
		it('handles complex templates');
		// TODO: inline slots, dynamic slots, with transforms, "let" blocks, and indentation everywhere
	});
	describe('async templates', function () {
		it('handles complex templates');
		// TODO: inline slots, dynamic slots, with transforms, "let" blocks, and indentation everywhere
	});
});
