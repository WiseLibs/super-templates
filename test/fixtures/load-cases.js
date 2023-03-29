'use strict';
const path = require('path');
const fs = require('fs');

const CASE_REGEX = /^case-(\d+)-([a-z][a-z0-9]*)\.[a-z][a-z0-9]*$/;

/*
	Returns a list of objects describing the test cases within the given
	directory of fixtures.
 */

module.exports = (category) => {
	if (typeof category !== 'string') {
		throw new TypeError('Expected category to be a string');
	}

	const dirname = path.join(__dirname, category);
	const cases = new Map();

	for (const basename of fs.readdirSync(dirname)) {
		const match = basename.match(CASE_REGEX);
		if (!match) {
			throw new TypeError(`Invalid case file name: ${basename}`);
		}

		const caseNumber = Number(match[1]);
		const fileType = match[2];

		let testCase = cases.get(caseNumber);
		if (!testCase) {
			testCase = { input: null, output: null };
			cases.set(caseNumber, testCase);
		}
		if (fileType !== 'input' && fileType !== 'output') {
			continue;
		}
		if (testCase[fileType] !== null) {
			throw new TypeError(`Duplicate ${fileType} file for case #${caseNumber}`);
		}

		testCase[fileType] = path.join(dirname, basename);
	}

	for (const [caseNumber, testCase] of cases) {
		if (testCase.input === null) {
			throw new TypeError(`Missing input file for case #${caseNumber}`);
		}
		if (testCase.output === null) {
			throw new TypeError(`Missing output file for case #${caseNumber}`);
		}
	}

	if (!cases.size) {
		throw new RangeError(`No test cases found in "${category}"`);
	}

	return [...cases].map(([caseNumber, obj]) => ({ caseNumber, ...obj }));
};
