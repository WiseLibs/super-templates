'use strict';
const fs = require('fs');
const path = require('path');
const chai = require('chai');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
let nextId = 1;

global.createTempFile = async (content) => {
	if (typeof content !== 'string') {
		throw new TypeError('Expected temp file content to be a string');
	}
	const filepath = path.join(TEMP_DIR, String(nextId++));
	await fs.promises.writeFile(filepath, content);
	return filepath;
};

global.expect = chai.expect;

before(function () {
	fs.rmSync(TEMP_DIR, { recursive: true, force: true });
	fs.mkdirSync(TEMP_DIR);
});

after(function () {
	fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});
