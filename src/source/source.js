'use strict';
const File = require('./file');
const Printer = require('./printer');

/*
	An object representing a piece of source code.
 */

module.exports = class Source {
	constructor(file, start, end) {
		if (!(file instanceof File)) {
			throw new TypeError('Expected file to be a File object');
		}
		if (!Number.isInteger(start)) {
			throw new TypeError('Expected start to be an integer');
		}
		if (!Number.isInteger(end)) {
			throw new TypeError('Expected end to be an integer');
		}
		if (start < 0) {
			throw new TypeError('Expected start to be non-negative');
		}
		if (end <= start) {
			throw new TypeError('Expected end to be greater than start');
		}
		if (end > file.content.length + 1) {
			throw new TypeError('Expected end to be less than or equal to the file length + 1');
		}

		this.file = file;
		this.start = start;
		this.end = end;
	}

	to(other) {
		if (!(other instanceof Source)) {
			throw new TypeError('Expected other to be a Source object');
		}
		if (other.file !== this.file) {
			throw new TypeError('Expected both Source objects to share the same file');
		}
		return new Source(this.file, this.start, other.end);
	}

	string() {
		return this.file.content.slice(this.start, this.end);
	}

	error(message, sourceMessage) {
		if (typeof message !== 'string') {
			throw new TypeError('Expected message to be a string');
		}
		if (typeof sourceMessage !== 'string' && sourceMessage !== undefined) {
			throw new TypeError('Expected sourceMessage to be a string or undefined');
		}
		return new Printer().error(message).source(this, sourceMessage);
	}

	warning(message, sourceMessage) {
		if (typeof message !== 'string') {
			throw new TypeError('Expected message to be a string');
		}
		if (typeof sourceMessage !== 'string' && sourceMessage !== undefined) {
			throw new TypeError('Expected sourceMessage to be a string or undefined');
		}
		return new Printer().warning(message).source(this, sourceMessage);
	}

	lines() {
		const { file: { content }, start, end } = this;
		const beforeEnd = end - (hasWindowsNewlineBefore(content, end) ? 2 : 1);
		const sl1 = content.slice(0, start).lastIndexOf('\n') + 1;
		const sl2 = searchUntil(content.slice(beforeEnd), /\r?\n/) + beforeEnd;
		const sl2LineStart = content.slice(0, sl2).lastIndexOf('\n') + 1;
		const lineNumber = 1 + countWithin(content.slice(0, sl1), '\n');
		const lines = content.slice(sl1, sl2).split(/\r?\n/).map(cleanString);
		const x1 = cleanString(content.slice(sl1, start)).length;
		const x2 = cleanString(content.slice(sl2LineStart, end)).length + (end > content.length ? 1 : 0);
		return { lines, lineNumber, x1, x2 };
	}
};

function hasWindowsNewlineBefore(content, index) {
	if (content[index - 1] !== '\n') return false;
	if (content[index - 2] !== '\r') return false;
	return true;
}

function searchUntil(content, terminator) {
	const index = content.search(terminator);
	return index >= 0 ? index : content.length;
}

function countWithin(content, term) {
	return content.split(term).length - 1;
}

function cleanString(content) {
	return content
		.replace(/\t/g, '    ')
		.replace(/\p{White_Space}/gu, ' ')
		.replace(/[\p{Cc}\p{Cs}\p{Cn}\p{Co}\p{Noncharacter_Code_Point}\ufeff]/gu, '\ufffd');
}
