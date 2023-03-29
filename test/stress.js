'use strict';
const fs = require('fs/promises');
const loadCases = require('./fixtures/load-cases');
const FT = require('../.');

async function createTemplate(filename, options = { syncOnly: true }) {
	const compiledTemplate = await FT.compile(filename, options);
	return FT.create(compiledTemplate);
}

async function createAsyncTemplate(filename) {
	const template = await createTemplate(filename, { syncOnly: false });
	return async () => {
		const output = [];
		for await (const str of template()) output.push(str);
		return output.join('');
	};
}

describe('stress tests', function () {
	const testCases = loadCases('stress');

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
