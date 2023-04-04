'use strict';
const { Source } = require('../source');
const { tk } = require('../lexer');

const NOT_WHITESPACE = /[^\x09\x0b\x0c\ufeff\x0a\x0d\u2028\u2029\p{Space_Separator}]/u;

/*
	These nodes form the AST of a super template file.
 */

class Node {
	constructor(source, children) {
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.source = source;
		this.children = children;
	}
}

class LineNode extends Node {
	constructor(source, isNewline) {
		super(source, []);
		if (typeof isNewline !== 'boolean') {
			throw new TypeError('Expected isNewline to be a boolean');
		}
		this.isNewline = isNewline;
		this.indentation = '';
	}
}

class LiteralNode extends Node {
	constructor({ source }) {
		super(source, []);
	}

	hasContent() {
		return NOT_WHITESPACE.test(this.source.string());
	}

	indexOfContent() {
		let index = this.source.string().search(NOT_WHITESPACE);
		if (index !== -1) {
			index += this.source.start;
		}
		return index;
	}
}

class ExpressionNode extends Node {
	constructor({ source, type, js }) {
		super(source, []);
		if (type !== 'normal' && type !== 'inject' && type !== 'effect') {
			throw new TypeError('Expected type to be "normal", "inject", or "effect"');
		}
		if (!(js instanceof tk.EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		this.type = type;
		this.js = js;
	}
}

class LetNode extends Node {
	constructor({ source, js, name }, children) {
		super(source, children);
		if (js !== null && !(js instanceof tk.EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object or null');
		}
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		this.js = js;
		this.name = name;
	}
}

class IfNode extends Node {
	constructor({ source, js }, trueBranch, falseBranch) {
		if (!Array.isArray(trueBranch)) {
			throw new TypeError('Expected trueBranch to be an array');
		}
		if (!Array.isArray(falseBranch)) {
			throw new TypeError('Expected falseBranch to be an array');
		}
		super(source, [...trueBranch, ...falseBranch]);
		if (!(js instanceof tk.EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		this.js = js;
		this.trueBranch = trueBranch;
		this.falseBranch = falseBranch;
	}
}

class EachNode extends Node {
	constructor({ source, js, name, indexName, lineSeparator }, trueBranch, falseBranch) {
		if (!Array.isArray(trueBranch)) {
			throw new TypeError('Expected trueBranch to be an array');
		}
		if (!Array.isArray(falseBranch)) {
			throw new TypeError('Expected falseBranch to be an array');
		}
		super(source, [...trueBranch, ...falseBranch]);
		if (!(js instanceof tk.EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		if (indexName !== null && typeof indexName !== 'string') {
			throw new TypeError('Expected indexName to be a string or null');
		}
		if (lineSeparator !== undefined && typeof lineSeparator !== 'string') {
			throw new TypeError('Expected lineSeparator to be a string');
		}
		this.js = js;
		this.name = name;
		this.indexName = indexName;
		this.lineSeparator = lineSeparator;
		this.trueBranch = trueBranch;
		this.falseBranch = falseBranch;
	}
}

class TransformNode extends Node {
	constructor({ source, js }, children) {
		super(source, children);
		if (!(js instanceof tk.EmbeddedJS)) {
			throw new TypeError('Expected js to be an EmbeddedJS object');
		}
		this.js = js;
	}
}

class IncludeNode extends Node {
	constructor({ source, js, path, bindings }, children) {
		super(source, children);
		if (!(js instanceof tk.EmbeddedJS)) {
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
		this.sections = undefined;
		this.ref = undefined;
	}
}

class SlotNode extends Node {
	constructor({ source, name }) {
		super(source, []);
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		this.name = name;
	}
}

class SectionNode extends Node {
	constructor({ source, name }, children) {
		super(source, children);
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		this.name = name;
	}
}

module.exports = {
	Node,
	LineNode,
	LiteralNode,
	ExpressionNode,
	LetNode,
	IfNode,
	EachNode,
	TransformNode,
	IncludeNode,
	SlotNode,
	SectionNode,
};
