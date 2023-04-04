'use strict';
const fs = require('fs/promises');
const loadCases = require('./fixtures/load-cases');
const ST = require('../.');

async function createTemplate(filename, options = { syncOnly: true }) {
	const compiledTemplate = await ST.compile(filename, options);
	return ST.create(compiledTemplate);
}

async function createAsyncTemplate(filename) {
	const template = await createTemplate(filename, { syncOnly: false });
	return async () => {
		const output = [];
		for await (const str of template()) output.push(str);
		return output.join('');
	};
}

describe('whitespace behavior', function () {
	const testCases = loadCases('whitespace');

	describe('sync templates', function () {
		for (const testCase of testCases) {
			it(`satisfies case #${testCase.caseNumber}`, async function () {
				const template = await createTemplate(testCase.input);
				expect(template()).to.equal(await fs.readFile(testCase.output, 'utf8'));
			});
		}
	});
	describe('async templates', function () {
		for (const testCase of testCases) {
			it(`satisfies case #${testCase.caseNumber}`, async function () {
				const template = await createAsyncTemplate(testCase.input);
				expect(await template()).to.equal(await fs.readFile(testCase.output, 'utf8'));
			});
		}
	});
});
