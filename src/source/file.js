'use strict';
const { Source } = require('./source');

/*
	An object representing an entire source code file.
 */

exports.File = class File {
	constructor(filename, content) {
		if (typeof filename !== 'string') {
			throw new TypeError('Expected filename to be a string');
		}
		if (typeof content !== 'string') {
			throw new TypeError('Expected content to be a string');
		}

		this.filename = filename;
		this.content = content;
	}

	at(start, length) {
		return new Source(this, start, start + length);
	}
};
