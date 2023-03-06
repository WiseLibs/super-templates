'use strict';
const util = require('util');
const stringWidth = require('string-width');

/*
	A string builder for making pretty error messages and printing chunks of
	relevant source code.
 */

module.exports = class Printer {
	constructor() {
		this._prev = undefined;
		this._indent = ' ';
		this._output = '';
		this._message = '';
	}

	error(msg) {
		if (typeof msg !== 'string') {
			throw new TypeError('Expected msg to be a string');
		}
		this._message = this._message || msg;
		this._output += red(`Error: ${msg}`) + '\n';
		return this;
	}

	warning(msg) {
		if (typeof msg !== 'string') {
			throw new TypeError('Expected msg to be a string');
		}
		this._message = this._message || msg;
		this._output += yellow(`Warning: ${msg}`) + '\n';
		return this;
	}

	note(msg) {
		if (typeof msg !== 'string') {
			throw new TypeError('Expected msg to be a string');
		}
		if (this._output.endsWith('\n\n')) this._output = this._output.slice(0, -1);
		this._output += blue(this._indent + ' * ' + msg) + '\n\n';
		return this;
	}

	source(source, msg = '') {
		if (typeof msg !== 'string') {
			throw new TypeError('Expected msg to be a string');
		}
		const { lines: rawLines, lineNumber, x1, x2 } = source.lines();
		const lines = rawLines.map((x, i) => (i > 0 ? red('| ') : '  ') + x);
		const indent = ' '.repeat(String(lineNumber + lines.length - 1).length);
		const guides = lines.map((_, i) => String(lineNumber + i).padStart(indent.length) + ' | ');
		const header = !this._prev || this._prev.file !== source.file
			? blue(indent + '--> ' + (source.file.filename || '{stdin}')) + '\n'
			: '';
		if (msg) msg = ' ' + msg;
		if (lines.length > 7) {
			guides.splice(4, lines.length - 6, '.'.repeat(indent.length + 1) + '  ');
			lines.splice(4, lines.length - 6, red('| '));
		}
		const w1 = stringWidth(rawLines[0].slice(0, x1));
		const w2 = stringWidth(rawLines[rawLines.length - 1].slice(0, x2)) + (x2 > rawLines[rawLines.length - 1].length ? 1 : 0);
		if (lines.length > 1) {
			guides.splice(1, 0, indent + ' | ');
			lines.splice(1, 0, red(' ' + '_'.repeat(w1 + 1) + '^'));
			lines.push(red('|' + '_'.repeat(w2) + '^' + msg));
		} else {
			lines.push(red(' '.repeat(w1 + 2) + '^'.repeat(w2 - w1) + msg));
		}
		guides.push(indent + ' | ');
		guides.unshift(indent + ' | ');
		lines.unshift('  ');
		this._prev = source;
		this._indent = indent;
		this._output += header + lines.map((x, i) => blue(guides[i]) + x).join('\n') + '\n\n';
		return this;
	}

	done() {
		return this._output.slice(0, -1);
	}

	toError() {
		const err = new Error(this._message);
		const output = this.done();
		Error.captureStackTrace(err, Printer.prototype.toError);
		Object.defineProperty(err, util.inspect.custom, {
			value: () => output,
			configurable: true,
			writable: true,
		});
		return err;
	}

	throw() {
		throw this.toError();
	}
};

const red = (x) => `\x1b[31m\x1b[1m${x}\x1b[0m`;
const blue = (x) => `\x1b[34m\x1b[1m${x}\x1b[0m`;
const yellow = (x) => `\x1b[33m\x1b[1m${x}\x1b[0m`;
