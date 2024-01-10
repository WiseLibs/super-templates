'use strict';
const { Source } = require('super-sources');

const NOT_WHITESPACE = /[^\x09\x0b\x0c\ufeff\x0a\x0d\u2028\u2029\p{Space_Separator}]/u;

/*
	The tokens yielded by the lexer.
 */

class Token {
	constructor(source) {
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}
		this.source = source;
	}

	get isBlock() {
		return false;
	}
}

class CommentToken extends Token {}
class EndToken extends Token {}
class NewlineToken extends Token {}

class IndentationToken extends Token {
	constructor(source, trim) {
		super(source);
		if (!Number.isInteger(trim)) {
			throw new TypeError('Expected trim to be an integer');
		}
		if (trim < 0) {
			throw new TypeError('Expected trim to be non-negative');
		}
		this.trim = trim;
	}

	getValue() {
		return this.source.string().slice(this.trim);
	}
}

class LiteralToken extends Token {
	hasContent() {
		return NOT_WHITESPACE.test(this.source.string());
	}
}

class ExpressionTagToken extends Token {
	constructor(source, type, js) {
		super(source);
		if (type !== 'normal' && type !== 'inject' && type !== 'effect') {
			throw new TypeError('Expected type to be "normal", "inject", or "effect"');
		}
		if (!(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		this.type = type;
		this.js = js;
	}
}

class SlotTagToken extends Token {
	constructor(source, name) {
		super(source);
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		this.name = name;
	}
}

class IncludeTagToken extends Token {
	constructor(source, js, path, bindings) {
		super(source);
		if (!(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		if (typeof path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}
		if (!Array.isArray(bindings)) {
			throw new TypeError('Expected bindings to be an array');
		}
		this.js = js;
		this.path = path;
		this.bindings = bindings;
	}
}

class IncludeBlockToken extends Token {
	constructor(source, js, path, bindings) {
		super(source);
		if (!(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		if (typeof path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}
		if (!Array.isArray(bindings)) {
			throw new TypeError('Expected bindings to be an array');
		}
		this.js = js;
		this.path = path;
		this.bindings = bindings;
	}

	get isBlock() {
		return true;
	}
}

class IfBlockToken extends Token {
	constructor(source, js) {
		super(source);
		if (!(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		this.js = js;
	}

	get isBlock() {
		return true;
	}
}

class ElseToken extends Token {
	constructor(source, js) {
		super(source);
		if (js !== null && !(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object or null');
		}
		this.js = js;
	}
}

class EachBlockToken extends Token {
	constructor(source, js, name, indexName) {
		super(source);
		if (!(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		if (indexName !== null && typeof indexName !== 'string') {
			throw new TypeError('Expected indexName to be a string or null');
		}
		this.js = js;
		this.name = name;
		this.indexName = indexName;
	}

	get isBlock() {
		return true;
	}
}

class TransformBlockToken extends Token {
	constructor(source, js) {
		super(source);
		if (!(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		this.js = js;
	}

	get isBlock() {
		return true;
	}
}

class LetBlockToken extends Token {
	constructor(source, js, name) {
		super(source);
		if (js !== null && !(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object or null');
		}
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		this.js = js;
		this.name = name;
	}

	get isBlock() {
		return true;
	}
}

class SectionBlockToken extends Token {
	constructor(source, name) {
		super(source);
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		this.name = name;
	}

	get isBlock() {
		return true;
	}
}

// Not technically a token.
class EmbeddedJS {
	constructor(source, names) {
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}
		if (!(names instanceof Set)) {
			throw new TypeError('Expected names to be a Set object');
		}
		this.source = source;
		this.names = names;
	}
}

// Not technically a token.
class Binding {
	constructor(source, name, js) {
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		if (!(js instanceof EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		this.source = source;
		this.name = name;
		this.js = js;
	}
}

module.exports = {
	Token,
	CommentToken,
	EndToken,
	NewlineToken,
	IndentationToken,
	LiteralToken,
	ExpressionTagToken,
	SlotTagToken,
	IncludeTagToken,
	IncludeBlockToken,
	IfBlockToken,
	ElseToken,
	EachBlockToken,
	TransformBlockToken,
	LetBlockToken,
	SectionBlockToken,
	EmbeddedJS,
	Binding,
};
