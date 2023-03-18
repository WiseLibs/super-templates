'use strict';

/*
	This function checks that the given value is something that can be inserted
	into a template, HTML-escapes it (unless `isRaw` is true), and returns it as
	an array of strings, such that line-terminating sequences are separated from
	the other parts of the string. Only strings, numbers, and bigints are
	allowed, but NaN is not allowed.
 */

exports.normalize = (value, location, isRaw = false) => {
	if (typeof value === 'string') {
		if (isRaw) return value;
		return escapeHTML(value);
	}
	if (typeof value === 'number') {
		if (value === value) return String(value);
		throw createRuntimeError(new TypeError('Template expression returned NaN'), location);
	}
	if (typeof value === 'bigint') {
		return String(value);
	}
	const type = value === null ? 'null' : typeof value;
	throw createRuntimeError(new TypeError(`Template expression returned an invalid type: ${type}`), location);
};

/*
	This function HTML-escapes the given string. It also works for XML.
	Strangely, this implementation is faster than doing a single call to
	`String.prototype.replace` and using a replacer function.
 */

function escapeHTML(str) {
	if (!str.length) {
		return str;
	}
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}

/*
	Creates a function that drives state and writes strings to an output array.
 */

const NOT_NEWLINE = /[^\x0a\x0d\u2028\u2029]/u;
const INDENT_SPOTS = /(?:\x0d\x0a|[\x0a\x0d\u2028\u2029])(?![\x0a\x0d\u2028\u2029]|$)/gu;
exports.createWriter = (output, state) => (str) => {
	if (!str) return;
	if (NOT_NEWLINE.test(str)) {
		if (state.pendingNewline) {
			output.push(state.pendingNewline);
			state.pendingNewline = '';
			state.atNewline = true;
		}
		if (state.indentation) {
			if (state.atNewline && !isNewline(str[0])) {
				output.push(state.indentation);
			}
			str = str.replace(INDENT_SPOTS, state.indenter);
		}
		state.atNewline = isNewline(str[str.length - 1]);
		state.blockHasContent = true;
	} else {
		state.atNewline = true;
	}
	output.push(str);
};

/*
	Checks whether the given one-character string is a newline character.
 */

function isNewline(char) {
	switch (char) {
		case '\n': return true;
		case '\r': return true;
		case '\u2028': return true;
		case '\u2029': return true;
		default: return false;
	}
}

/*
	Scope is used to manage/organize a compiled template's variable context.
	TODO: make this compatible with async codegen
 */

exports.Scope = class Scope {
	constructor() {
		this.vars = Object.create(null);
	}
	with(name, value) {
		const scope = new Scope();
		Object.assign(scope.vars, this.vars);
		scope.vars[name] = value;
		return scope;
	}
	withTwo(name1, value1, name2, value2) {
		const scope = new Scope();
		Object.assign(scope.vars, this.vars);
		scope.vars[name1] = value1;
		scope.vars[name2] = value2;
		return scope;
	}
};

/*
	Wraps the given function so that if it throws an exception, a nicely
	formatted error will be raised, containing the source location.
 */

exports.trace = (fn, location) => {
	return (arg) => {
		try {
			return fn(arg);
		} catch (err) {
			throw createRuntimeError(err, location, true);
		}
	};
};

function createRuntimeError(err, location, isEmbeddedJS = false) {
	const extraMessage = isEmbeddedJS ? '\nUnexpected error in template\'s embedded JavaScript' : '';

	if (err instanceof Error) {
		err.message += extraMessage;
		err.stack = `${err}\n    at ${location}` + (err.stack || '')
			.split(/\r?\n/)
			.filter(str => /^\s+at (?!ft_\d+)/.test(str))
			.map(str => '\n' + str)
			.join('')
	} else {
		err = new Error(String(err) + extraMessage);
		err.stack = `${err}\n    at ${location}`;
	}

	return err;
}
