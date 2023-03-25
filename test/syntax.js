'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('syntax features', function () {
	it('allows unterminated "let" blocks in the preamble', async function () {
		const template = await createTemplate('{{let x: 123}}{{let y: 456}}foo{{x}}bar{{y}}');
		expect(template()).to.equal('foo123bar456');
	});
	it('allows unterminated "include" blocks in the preamble', async function () {
		const filename1 = await createTempFile('[{{slot}}]');
		const filename2 = await createTempFile(`{{include ${JSON.stringify(filename1)}}}({{slot}})`);
		const template = await createTemplate(`{{include ${JSON.stringify(filename2)}}}hello`);
		expect(template()).to.equal('[(hello)]');
	});
});
