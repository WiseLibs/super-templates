'use strict';
const { parseExpressionAt } = require('acorn');
const { File } = require('super-sources');

/*
	The scanner used for lexing. It can scan based on strings or RegExp objects,
	and it can parse embedded JavaScript expressions.
 */

module.exports = class Tokenizer {
	constructor(file) {
		if (!(file instanceof File)) {
			throw new TypeError('Expected file to be a File object');
		}
		this._file = file;
		this._index = 0;
		this._endIndex = file.content.length;
		this._captured = file.at(0, 1);
	}

	acceptUntil(pattern) {
		if (!(pattern instanceof RegExp)) {
			throw new TypeError('Expected pattern to be a RegExp object');
		}
		if (pattern.sticky) {
			throw new TypeError('Expected pattern RegExp to not be sticky');
		}
		if (!pattern.global) {
			throw new TypeError('Expected pattern RegExp to be global');
		}
		pattern.lastIndex = this._index;
		const match = pattern.exec(this._file.content);
		const index = match ? match.index : this._endIndex;
		if (index > this._index) {
			this._captured = this._file.at(this._index, index - this._index);
			this._index = index;
			return true;
		}
		return false;
	}

	acceptStr(pattern) {
		if (typeof pattern !== 'string') {
			throw new TypeError('Expected pattern to be a string');
		}
		if (this._file.content.startsWith(pattern, this._index)) {
			const length = pattern.length;
			this._captured = this._file.at(this._index, length);
			this._index += length;
			return true;
		}
		return false;
	}

	acceptRe(pattern) {
		if (!(pattern instanceof RegExp)) {
			throw new TypeError('Expected pattern to be a RegExp object');
		}
		if (!pattern.sticky) {
			throw new TypeError('Expected pattern RegExp to be sticky');
		}
		pattern.lastIndex = this._index;
		const match = pattern.exec(this._file.content);
		if (match) {
			const length = match[0].length;
			this._captured = this._file.at(this._index, length);
			this._index += length;
			return true;
		}
		return false;
	}

	expectStr(pattern) {
		if (!this.acceptStr(pattern)) this.fail();
	}

	expectRe(pattern) {
		if (!this.acceptRe(pattern)) this.fail();
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
			if (this._index < this._endIndex) {
				message = 'Unexpected token';
			} else {
				message = 'Unexpected end of input';
			}
		}
		return this._file.at(this._index, length).error(message).throw();
	}

	undo() {
		this._index = this._captured.start;
	}

	isDone() {
		return this._index === this._endIndex;
	}

	getCaptured() {
		return this._captured;
	}
};

function parseJavaScript(self) {
	try {
		return parseExpressionAt(self._file.content, self._index, JS_OPTIONS);
	} catch (err) {
		if (err instanceof SyntaxError && Number.isInteger(err.pos)) {
			if (err.pos < self._file.content.length) {
				const message = err.message.replace(/\([\s\S]*/, '');
				const length = Math.max(1, (err.raisedAt || 0) - err.pos);
				self._index = err.pos;
				self.fail(message, length);
			} else {
				self._index = self._file.content.length;
				self.fail();
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
