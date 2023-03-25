'use strict';
const fs = require('fs/promises');
const FT = require('../.');

async function createTemplate(content, options = { syncOnly: true }) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, options);
	return FT.create(compiledTemplate);
}

async function createAsyncTemplate(content) {
	return wrapAsyncTemplate(
		await createTemplate(content, { syncOnly: false })
	);
}

function wrapAsyncTemplate(template) {
	return async () => {
		const output = [];
		for await (const str of template()) output.push(str);
		return output.join('');
	};
}

describe('recursive templates', function () {
	describe('sync templates', function () {
		it('renders recursive templates', async function () {
			const filename = await createTempFile('');
			await fs.writeFile(filename, `{{let x}}{{if x > 0}}{{x}}, {{> ${JSON.stringify(filename)} with x: x - 1}}{{else}}done{{end}}`);
			const template = await createTemplate(`{{> ${JSON.stringify(filename)} with x: 10}}`);
			expect(template()).to.equal('10, 9, 8, 7, 6, 5, 4, 3, 2, 1, done');
		});
		it('renders mutually recursive templates', async function () {
			global.x = { y: 5 };
			try {
				const filename1 = await createTempFile('');
				const filename2 = await createTempFile(`{{let y}}{{include ${JSON.stringify(filename1)}}}{{y}}, {{end}}{{end}}`);
				await fs.writeFile(filename1, `{{slot}}{{if x.y > 0}}{{> ${JSON.stringify(filename2)} with y: x.y--}}{{else}}done{{end}}`);
				const compiledTemplate = await FT.compile(filename1, { syncOnly: true });
				const template = FT.create(compiledTemplate);
				expect(template()).to.equal('5, 4, 3, 2, 1, done');
				expect(global.x.y).to.equal(0);
			} finally {
				delete global.x;
			}
		});
	});
	describe('async templates', function () {
		it('renders recursive templates', async function () {
			const filename = await createTempFile('');
			await fs.writeFile(filename, `{{let x}}{{if x > 0}}{{x}}, {{> ${JSON.stringify(filename)} with x: x - 1}}{{else}}done{{end}}`);
			const template = await createAsyncTemplate(`{{> ${JSON.stringify(filename)} with x: 10}}`);
			expect(await template()).to.equal('10, 9, 8, 7, 6, 5, 4, 3, 2, 1, done');
		});
		it('renders mutually recursive templates', async function () {
			global.x = { y: 5 };
			try {
				const filename1 = await createTempFile('');
				const filename2 = await createTempFile(`{{let y}}{{include ${JSON.stringify(filename1)}}}{{y}}, {{end}}{{end}}`);
				await fs.writeFile(filename1, `{{slot}}{{if x.y > 0}}{{> ${JSON.stringify(filename2)} with y: x.y--}}{{else}}done{{end}}`);
				const compiledTemplate = await FT.compile(filename1, { syncOnly: false });
				const template = wrapAsyncTemplate(FT.create(compiledTemplate));
				expect(await template()).to.equal('5, 4, 3, 2, 1, done');
				expect(global.x.y).to.equal(0);
			} finally {
				delete global.x;
			}
		});
	});
});
