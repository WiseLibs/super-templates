'use strict';
const FT = require('../.');

async function createTemplate(content, options = { syncOnly: true }, helpers = {}) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, options);
	return FT.create(compiledTemplate, helpers);
}

async function createAsyncTemplate(content, helpers = {}) {
	const template = await createTemplate(content, { syncOnly: false }, helpers);
	return async () => {
		const output = [];
		for await (const str of template()) output.push(str);
		return output.join('');
	};
}

describe('scope resolution', function () {
	describe('sync templates', function () {
		it('provides access to the global scope', async function () {
			global.foo = 123;
			try {
				const template = await createTemplate('foo{{foo}}bar{{global.foo}}');
				expect(template()).to.equal('foo123bar123');
			} finally {
				delete global.foo;
			}
		});
		it('provides access to user-defined helpers', async function () {
			const helpers = { foo: 456 };
			const template = await createTemplate('foo{{foo}}bar', undefined, helpers);
			expect(template()).to.equal('foo456bar');
		});
		it('provides scopes that shadow over previous scopes', async function () {
			global.foo = 10;
			global.bar = 11;
			global.baz = 12;
			try {
				const helpers = { foo: 20, bar: 21 };
				const template = await createTemplate('{{let foo: 30}}{{foo}},{{bar}},{{baz}},{{end}}{{foo}},{{bar}},{{baz}}', undefined, helpers);
				expect(template()).to.equal('30,21,12,20,21,12');
			} finally {
				delete global.foo;
				delete global.bar;
				delete global.baz;
			}
		});
		it('provides a "this" value of undefined', async function () {
			const template = await createTemplate('foo,{{String(this)}},bar');
			expect(template()).to.equal('foo,undefined,bar');
		});
	});
	describe('async templates', function () {
		it('provides access to the global scope', async function () {
			global.foo = 123;
			try {
				const template = await createAsyncTemplate('foo{{foo}}bar{{global.foo}}');
				expect(await template()).to.equal('foo123bar123');
			} finally {
				delete global.foo;
			}
		});
		it('provides access to user-defined helpers', async function () {
			const helpers = { foo: 456 };
			const template = await createAsyncTemplate('foo{{foo}}bar', helpers);
			expect(await template()).to.equal('foo456bar');
		});
		it('provides scopes that shadow over previous scopes', async function () {
			global.foo = 10;
			global.bar = 11;
			global.baz = 12;
			try {
				const helpers = { foo: 20, bar: 21 };
				const template = await createAsyncTemplate('{{let foo: 30}}{{foo}},{{bar}},{{baz}},{{end}}{{foo}},{{bar}},{{baz}}', helpers);
				expect(await template()).to.equal('30,21,12,20,21,12');
			} finally {
				delete global.foo;
				delete global.bar;
				delete global.baz;
			}
		});
		it('provides a "this" value of undefined', async function () {
			const template = await createAsyncTemplate('foo,{{String(this)}},bar');
			expect(await template()).to.equal('foo,undefined,bar');
		});
	});
});
