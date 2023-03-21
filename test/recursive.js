'use strict';
const fs = require('fs/promises');
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('recursive templates', function () {
	it('renders recursive templates', async function () {
		const filename = await createTempFile('');
		await fs.writeFile(filename, `{{let x}}{{if x > 0}}{{x}}, {{> ${JSON.stringify(filename)} with x: x - 1}}{{else}}done{{end}}`);
		const template = await createTemplate(`{{> ${JSON.stringify(filename)} with x: 10}}`)
		expect(template()).to.equal('10, 9, 8, 7, 6, 5, 4, 3, 2, 1, done');
	});
	it('renders mutually recursive templates');
	it('renders correct indentation for recursive templates');
});
