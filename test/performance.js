'use strict';
const ST = require('../.');

async function createTemplate(content, options = { syncOnly: true }) {
	const filename = await createTempFile(content);
	const compiledTemplate = await ST.compile(filename, options);
	return ST.create(compiledTemplate, { delay });
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
		return output;
	};
}

function delay(value) {
	return new Promise((resolve) => setImmediate(() => resolve(value)));
}

describe('performance', function () {
	it('joins strings that are rendered in the same event loop tick', async function () {
		const template = await createAsyncTemplate('foo{{"bar"}}baz{{if true}}{{"qux"}}{{end}}');
		expect(await template()).to.deep.equal(['foobarbazqux']);
	});
	it('does not join strings that are rendered at different times', async function () {
		const template = await createAsyncTemplate('foo{{delay("bar")}}baz{{if true}}{{"qux"}}{{end}}');
		expect(await template()).to.deep.equal(['foo', 'barbazqux']);
	});
});
