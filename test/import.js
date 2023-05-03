'use strict';
const fs = require('fs');
const util = require('util');
const ST = require('../.');

async function expectRender(value, fn) {
	const template = ST.create(await fn())
	const output = [];
	for await (const str of template()) output.push(str);
	expect(output.join('')).to.equal(value);
}

async function expectError(message, fn, hasCustomInspect) {
	try {
		await fn();
	} catch (err) {
		expect(err.message.split(/\r?\n/)[0]).to.equal(message);
		if (hasCustomInspect !== undefined) {
			expect(util.inspect.custom in err).to.equal(hasCustomInspect);
		}
		return;
	}
	throw new Error('Expected an error to be thrown');
}

describe('import features', function () {
	it('supports custom resolve() functions', async function () {
		const filename1 = await createTempFile('{{> "HELLO"}}');
		const filename2 = await createTempFile('{{> "GOODBYE"}}');
		const filename3 = await createTempFile('hello');
		const resolve = (str) => {
			if (str === 'HELLO') return filename3;
			throw new Error('Failed to find file');
		};
		await expectRender('hello', () => ST.compile(filename1, { resolve }));
		await expectError('Failed to find file', () => ST.compile(filename2, { resolve }));
	});
	it('supports async resolve() functions', async function () {
		const filename1 = await createTempFile('{{> "HELLO"}}');
		const filename2 = await createTempFile('{{> "GOODBYE"}}');
		const filename3 = await createTempFile('hello');
		const resolve = (str) => {
			if (str === 'HELLO') return Promise.resolve(filename3);
			return Promise.reject(new Error('Failed to find file'));
		};
		await expectRender('hello', () => ST.compile(filename1, { resolve }));
		await expectError('Failed to find file', () => ST.compile(filename2, { resolve }));
	});
	it('throws regular errors in resolve()', async function () {
		const filename = await createTempFile('{{> "HELLO"}}');
		const resolve = (str) => {
			return Promise.reject(new Error('Failed to find file'));
		};
		await expectError('Failed to find file', () => ST.compile(filename, { resolve }), false);
	});
	it('throws pretty exposed errors in resolve()', async function () {
		const filename = await createTempFile('{{> "HELLO"}}');
		const resolve = (str) => {
			return Promise.reject(Object.assign(new Error('Failed to find file'), { expose: true }));
		};
		await expectError('Failed to find file', () => ST.compile(filename, { resolve }), true);
	});
	it('supports custom load() functions', async function () {
		const filename1 = await createTempFile('{{> "HELLO"}}');
		const filename2 = await createTempFile('{{> "GOODBYE"}}');
		const resolve = str => str;
		const load = (str) => {
			if (str === filename1 || str === filename2) return fs.readFileSync(str, 'utf8');
			if (str === 'HELLO') return 'hello';
			throw new Error('Failed to load file');
		};
		await expectRender('hello', () => ST.compile(filename1, { resolve, load }));
		await expectError('Failed to load file', () => ST.compile(filename2, { resolve, load }));
	});
	it('supports async load() functions', async function () {
		const filename1 = await createTempFile('{{> "HELLO"}}');
		const filename2 = await createTempFile('{{> "GOODBYE"}}');
		const resolve = str => str;
		const load = (str) => {
			if (str === filename1 || str === filename2) return fs.promises.readFile(str, 'utf8');
			if (str === 'HELLO') return Promise.resolve('hello');
			return Promise.reject(new Error('Failed to load file'));
		};
		await expectRender('hello', () => ST.compile(filename1, { resolve, load }));
		await expectError('Failed to load file', () => ST.compile(filename2, { resolve, load }));
	});
	it('throws regular errors in load()', async function () {
		const filename = await createTempFile('{{> "HELLO"}}');
		const load = (str) => {
			if (str === filename) return fs.promises.readFile(str, 'utf8');
			return Promise.reject(new Error('Failed to find file'));
		};
		await expectError('Failed to find file', () => ST.compile(filename, { load }), false);
	});
	it('throws pretty exposed errors in load()', async function () {
		const filename = await createTempFile('{{> "HELLO"}}');
		const load = (str) => {
			if (str === filename) return fs.promises.readFile(str, 'utf8');
			return Promise.reject(Object.assign(new Error('Failed to find file'), { expose: true }));
		};
		await expectError('Failed to find file', () => ST.compile(filename, { load }), true);
	});
	it('throws pretty errors for ENOENT in load()', async function () {
		const filename = await createTempFile('{{> "HELLO"}}');
		const resolve = str => str;
		const load = str => fs.promises.readFile(str, 'utf8');
		await expectError('Could not resolve "HELLO"', () => ST.compile(filename, { resolve, load }), true);
	});
});
