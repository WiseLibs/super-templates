'use strict';
const { parseExpressionAt } = require('acorn');
const { File, Printer } = require('../source');

/*
	The parser state and methods used for recursive descent parsing.
 */

module.exports = class Parser {
	constructor(file) {
		if (!(file instanceof File)) {
			throw new TypeError('Expected file to be a File object');
		}
		this._file = file;
		this._index = 0;
		this._captured = file.at(0, 1);
		this._isPreamble = true;
	}

	acceptUntil(pattern) {
		const { content } = this._file;
		if (typeof pattern === 'string') {
			if (!pattern) {
				throw new TypeError('Expected pattern string to be non-empty');
			}
			let index = content.indexOf(pattern, this._index);
			if (index === -1) {
				index = content.length;
			}
			if (index > this._index) {
				this._captured = this._file.at(this._index, index - this._index);
				this._index = index;
				return true;
			}
			return false;
		}
		if (pattern instanceof RegExp) {
			if (pattern.sticky) {
				throw new TypeError('Expected pattern RegExp to not be sticky');
			}
			if (!pattern.global) {
				throw new TypeError('Expected pattern RegExp to be global');
			}
			pattern.lastIndex = this._index;
			const match = pattern.exec(content);
			const index = match ? match.index : content.length;
			if (index > this._index) {
				this._captured = this._file.at(this._index, index - this._index);
				this._index = index;
				return true;
			}
			return false;
		}
		throw new TypeError('Expected pattern to be a string or RegExp object');
	}

	accept(pattern) {
		const { content } = this._file;
		if (typeof pattern === 'string') {
			if (!pattern) {
				throw new TypeError('Expected pattern string to be non-empty');
			}
			if (content.startsWith(pattern, this._index)) {
				this._captured = this._file.at(this._index, pattern.length);
				this._index += pattern.length;
				if (this._index > content.length) {
					throw new TypeError('Parser overflow');
				}
				return true;
			}
			return false;
		}
		if (pattern instanceof RegExp) {
			if (!pattern.sticky) {
				throw new TypeError('Expected pattern RegExp to be sticky');
			}
			pattern.lastIndex = this._index;
			const match = pattern.exec(content);
			if (match) {
				this._captured = this._file.at(this._index, match[0].length);
				this._index += match[0].length;
				if (this._index > content.length) {
					throw new TypeError('Parser overflow');
				}
				return true;
			}
			return false;
		}
		throw new TypeError('Expected pattern to be a string or RegExp object');
	}

	expect(pattern) {
		if (!this.accept(pattern)) this.fail();
	}

	expectJavaScript() {
		const parsedJS = parseJavaScript(this);
		const length = Math.max(1, parsedJS.end - parsedJS.start);
		this._captured = this._file.at(parsedJS.start, length);
		this._index = parsedJS.end;
		return parsedJS;
	}

	fail(message, length = 1) {
		if (message === undefined) {
			if (this._index < this._file.content.length) {
				message = 'Unexpected token';
			} else {
				message = 'Unexpected end of input';
			}
		}
		return new Printer()
			.error(message)
			.source(this._file.at(this._index, length))
			.throw();
	}

	undo() {
		this._index = this._captured.start;
	}

	endPreamble() {
		this._isPreamble = false;
	}

	isPreamble() {
		return this._isPreamble;
	}

	isDone() {
		return this._index === this._file.content.length;
	}

	getCaptured() {
		return this._captured;
	}
};

function parseJavaScript(parser) {
	try {
		return parseExpressionAt(parser._file.content, parser._index, JS_OPTIONS);
	} catch (err) {
		if (err instanceof SyntaxError && Number.isInteger(err.pos)) {
			if (err.pos < parser._file.content.length) {
				const message = err.message.replace(/\([\s\S]*/, '');
				const length = Math.max(1, (err.raisedAt || 0) - err.pos);
				parser._index = err.pos;
				parser.fail(message, length);
			} else {
				parser._index = parser._file.content.length;
				parser.fail();
			}
		}
		throw err;
	}
}

const JS_OPTIONS = {
	ecmaVersion: 'latest',
	sourceType: 'module',
	preserveParens: true,
	allowReserved: false,
	allowReturnOutsideFunction: false,
	allowImportExportEverywhere: false,
	allowAwaitOutsideFunction: false,
	allowSuperOutsideMethod: false,
	allowHashBang: false,
};
