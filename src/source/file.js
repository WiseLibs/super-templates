'use strict';

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

// Required here because of circular dependencies.
const { Source } = require('./source');
