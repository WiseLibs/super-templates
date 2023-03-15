'use strict';

/*
	This function checks that the given value is something that can be inserted
	into a template, HTML-escapes it (unless `isRaw` is true), and returns it as
	an array of strings, such that line-terminating sequences are separated from
	the other parts of the string. Only strings, numbers, and bigints are
	allowed, but NaN is not allowed.
 */

exports.normalize = (value, isRaw = false) => {
	if (typeof value === 'string') {
		if (isRaw) return splitLines(value);
		return splitLines(escapeHTML(value));
	}
	if (typeof value === 'number') {
		if (value === value) return [String(value)];
		throw new TypeError('Template expression returned NaN');
	}
	if (typeof value === 'bigint') {
		return [String(value)];
	}
	const type = value === null ? 'null' : typeof value;
	throw new TypeError(`Template expression returned an invalid type: ${type}`);
};

/*
	This is a highly optimized function that splits a string by line-terminating
	characters. It takes advantage of the fact that `String.prototype.indexOf`
	is much faster than RegExp in JavaScript, at least when searching for
	single-character strings.

	It recognizes line-terminators "\n", "\r\n", "\r", "\u2028", and "\u2029".
 */

function splitLines(str) {
	if (!str.length) {
		return [];
	}

	const results = [];

	let cache1 = -1;
	let cache2 = -1;
	let cache3 = -1;
	let cache4 = -1;

	let position = 0;
	while (position < str.length) {
		if (cache1 < 0) {
			const i = str.indexOf('\n', position);
			cache1 = i < 0 ? str.length : i;
		}
		if (cache2 < 0) {
			const i = str.indexOf('\r', position);
			cache2 = i < 0 ? str.length : i;
		}
		if (cache3 < 0) {
			const i = str.indexOf('\u2028', position);
			cache3 = i < 0 ? str.length : i;
		}
		if (cache4 < 0) {
			const i = str.indexOf('\u2029', position);
			cache4 = i < 0 ? str.length : i;
		}

		let index;
		let match;
		if (cache1 <= cache2) {
			if (cache1 <= cache3) {
				if (cache1 <= cache4) {
					index = cache1;
					cache1 = -1;
					match = '\n';
				} else {
					index = cache4;
					cache4 = -1;
					match = '\u2029';
				}
			} else {
				if (cache3 <= cache4) {
					index = cache3;
					cache3 = -1;
					match = '\u2028';
				} else {
					index = cache4;
					cache4 = -1;
					match = '\u2029';
				}
			}
		} else {
			if (cache2 <= cache3) {
				if (cache2 <= cache4) {
					index = cache2;
					cache2 = -1;
					if (str[index + 1] === '\n') {
						cache1 = -1;
						match = '\r\n';
					} else {
						match = '\r';
					}
				} else {
					index = cache4;
					cache4 = -1;
					match = '\u2029';
				}
			} else {
				if (cache3 <= cache4) {
					index = cache3;
					cache3 = -1;
					match = '\u2028';
				} else {
					index = cache4;
					cache4 = -1;
					match = '\u2029';
				}
			}
		}

		if (index === str.length) {
			results.push(position > 0 ? str.substring(position, index) : str);
			break;
		}

		if (index > position) {
			results.push(str.substring(position, index));
		}
		results.push(match);
		position = index + match.length;
	}

	return results;
}

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
	Checks whether the given string is a line-terminating sequence.
 */

exports.isNewline = (str) => {
	switch (str) {
		case '\n': return true;
		case '\r': return true;
		case '\r\n': return true;
		case '\u2028': return true;
		case '\u2029': return true;
		default: return false;
	}
};

/*
	Scope is used to manage/organize a compiled template's execution context.
	For example, it stores state regarding the current "let" variables and
	"include" context.
	TODO: make this compatible with async codegen
 */

exports.Scope = class Scope {
	constructor(ctx) {
		this.ctx = ctx;
		this.vars = Object.create(null);
	}
	with(name, value) {
		const scope = new Scope(this.ctx);
		Object.assign(scope.vars, this.vars);
		scope.vars[name] = value;
		return scope;
	}
	withTwo(name1, value1, name2, value2) {
		const scope = new Scope(this.ctx);
		Object.assign(scope.vars, this.vars);
		scope.vars[name1] = value1;
		scope.vars[name2] = value2;
		return scope;
	}
};
