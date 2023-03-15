'use strict';
const { File } = require('../source');
const { lex } = require('../lexer');
const beautify = require('./beautify');

/*
	The parser state used for recursive descent parsing.
 */

module.exports = class Parser {
	constructor(file) {
		if (!(file instanceof File)) {
			throw new TypeError('Expected file to be a File object');
		}
		this._iterator = beautify(lex(file));
		this.file = file;
		this.state = {};
	}

	next() {
		const { value } = this._iterator.next();
		return value;
	}
};
