'use strict';

/*
	This function checks that the given value is something that can be inserted
	into a template, HTML-escapes it (unless `isRaw` is true), and returns it as
	a string. A source location is needed in case of error.
	Only strings, numbers, and bigints are allowed, but NaN is not allowed.
 */

function normalize(value, location, isRaw = false) {
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
}

/*
	This function HTML-escapes the given string. It also works for XML.
	Strangely, this implementation is faster than doing a single call to
	`String.prototype.replace` and using a replacer function.
 */

function escapeHTML(str) {
	if (!str) {
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
	Creates a "write()" function, which drives the given template state, handles
	dynamic indentation and dynamic newlines, and pushes the resulting strings
	into the given output array.
 */

const NOT_NEWLINE = /[^\x0a\x0d\u2028\u2029]/u;
const INDENT_SPOTS = /(?:\x0d\x0a|[\x0a\x0d\u2028\u2029])(?![\x0a\x0d\u2028\u2029]|$)/gu;
function createWriter(output, state) {
	return (str) => {
		if (!str) return;
		if (NOT_NEWLINE.test(str)) {
			if (state.pendingNewline) {
				output.push(state.pendingNewline);
				state.pendingNewline = '';
				state.atNewline = true;
			}
			if (state.indentation) {
				if (state.atNewline && !isNewlineChar(str[0])) {
					output.push(state.indentation);
				}
				str = str.replace(INDENT_SPOTS, '$&' + state.indentation);
			}
			state.atNewline = isNewlineChar(str[str.length - 1]);
			state.blockHasContent = true;
		} else {
			state.atNewline = true;
		}
		output.push(str);
	};
}

/*
	Checks whether the given one-character string is a newline character.
 */

function isNewlineChar(char) {
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

class Scope {
	constructor() {
		this._vars = Object.create(null);
	}
	with(name, value) {
		const scope = new Scope();
		Object.assign(scope._vars, this._vars);
		scope._vars[name] = value;
		return scope;
	}
	withTwo(name1, value1, name2, value2) {
		const scope = new Scope();
		Object.assign(scope._vars, this._vars);
		scope._vars[name1] = value1;
		scope._vars[name2] = value2;
		return scope;
	}
	use() {
		return this._vars;
	}
}

/*
	Wraps the given function (which should be an embedded/compiled JSFunc) so
	that if it throws an exception, a nicely formatted error will be raised,
	containing the source location.
 */

function trace(fn, location) {
	return function ft_trace(arg) {
		try {
			return fn(arg);
		} catch (err) {
			throw createRuntimeError(err, location, true);
		}
	};
}

function createRuntimeError(err, location, isEmbeddedJS = false) {
	const extraMessage = isEmbeddedJS ? '\nUnexpected error in template\'s embedded JavaScript' : '';

	if (err instanceof Error) {
		err.message += extraMessage;
		err.stack = `${err}\n    at ${location}` + (err.stack || '')
			.split(/\r?\n/)
			.filter(str => /^\s+at (?!ft_(?:\d|trace))/.test(str))
			.map(str => '\n' + str)
			.join('')
	} else {
		err = new Error(String(err) + extraMessage);
		err.stack = `${err}\n    at ${location}`;
	}

	return err;
}

module.exports = {
	normalize,
	createWriter,
	Scope,
	trace,
};
