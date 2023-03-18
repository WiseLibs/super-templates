'use strict';
const { Source } = require('../source');

class ASM {}

class DynamicBlock extends ASM {
	constructor(children) {
		super();
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.children = children;
	}
}

class DynamicNewline extends ASM {
	constructor(newline, children) {
		super();
		if (typeof newline !== 'string') {
			throw new TypeError('Expected newline to be a string');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.newline = newline;
		this.children = children;
	}
}

class DynamicIndentation extends ASM {
	constructor(indentation, children) {
		super();
		if (typeof indentation !== 'string') {
			throw new TypeError('Expected indentation to be a string');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.indentation = indentation;
		this.children = children;
	}
}

class PrintLiteral extends ASM {
	constructor(content) {
		super();
		if (typeof content !== 'string') {
			throw new TypeError('Expected content to be a string');
		}
		this.content = content;
	}
}

class PrintExpression extends ASM {
	constructor(js, isRaw) {
		super();
		if (!(js instanceof JSFunc)) {
			throw new TypeError('Expected js to be a JSFunc object');
		}
		if (typeof isRaw !== 'boolean') {
			throw new TypeError('Expected isRaw to be a boolean');
		}
		this.js = js;
		this.isRaw = isRaw;
	}
}

class Effect extends ASM {
	constructor(js) {
		super();
		if (!(js instanceof JSFunc)) {
			throw new TypeError('Expected js to be a JSFunc object');
		}
		this.js = js;
	}
}

class DynamicSlot extends ASM {
	constructor(name) {
		super();
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		this.name = name;
	}
}

class InlineSlot extends ASM {
	constructor(name, children) {
		super();
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.name = name;
		this.children = children;
	}
}

class DynamicInclude extends ASM {
	constructor(bindings, sections) {
		super();
		if (!(bindings instanceof Map)) {
			throw new TypeError('Expected bindings to be a Map object');
		}
		if (!(sections instanceof Map)) {
			throw new TypeError('Expected sections to be a Map object');
		}
		this.bindings = bindings;
		this.sections = sections;
		this.ref = undefined;
	}
}

class InlineInclude extends ASM {
	constructor(bindings, children) {
		super();
		if (!(bindings instanceof Map)) {
			throw new TypeError('Expected bindings to be a Map object');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.bindings = bindings;
		this.children = children;
	}
}

class LetBlock extends ASM {
	constructor(js, name, children) {
		super();
		if (js !== null && !(js instanceof JSFunc)) {
			throw new TypeError('Expected js to be a JSFunc object or null');
		}
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.js = js;
		this.name = name;
		this.children = children;
	}
}

class IfBlock extends ASM {
	constructor(js, trueBranch, falseBranch) {
		super();
		if (!(js instanceof JSFunc)) {
			throw new TypeError('Expected js to be a JSFunc object');
		}
		if (!Array.isArray(trueBranch)) {
			throw new TypeError('Expected trueBranch to be an array');
		}
		if (!Array.isArray(falseBranch)) {
			throw new TypeError('Expected falseBranch to be an array');
		}
		this.js = js;
		this.trueBranch = trueBranch;
		this.falseBranch = falseBranch;
	}
}

class EachBlock extends ASM {
	constructor(js, trueBranch, falseBranch, name, indexName, lineSeparator) {
		super();
		if (!(js instanceof JSFunc)) {
			throw new TypeError('Expected js to be a JSFunc object');
		}
		if (!Array.isArray(trueBranch)) {
			throw new TypeError('Expected trueBranch to be an array');
		}
		if (!Array.isArray(falseBranch)) {
			throw new TypeError('Expected falseBranch to be an array');
		}
		if (typeof name !== 'string') {
			throw new TypeError('Expected name to be a string');
		}
		if (indexName !== null && typeof indexName !== 'string') {
			throw new TypeError('Expected indexName to be a string or null');
		}
		if (typeof lineSeparator !== 'string') {
			throw new TypeError('Expected lineSeparator to be a string');
		}
		this.js = js;
		this.trueBranch = trueBranch;
		this.falseBranch = falseBranch;
		this.name = name;
		this.indexName = indexName;
		this.lineSeparator = lineSeparator;
	}
}

class TransformBlock extends ASM {
	constructor(js, children) {
		super();
		if (!(js instanceof JSFunc)) {
			throw new TypeError('Expected js to be a JSFunc object');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.js = js;
		this.children = children;
	}
}

class TemplateFunc extends ASM {
	constructor(children) {
		super();
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.children = children;
	}
}

class JSFunc extends ASM {
	constructor(source, dependencyNames) {
		super();
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}
		if (!Array.isArray(dependencyNames)) {
			throw new TypeError('Expected dependencyNames to be an array');
		}
		this.source = source;
		this.dependencyNames = dependencyNames;
	}
}

module.exports = {
	ASM,
	DynamicBlock,
	DynamicNewline,
	DynamicIndentation,
	PrintLiteral,
	PrintExpression,
	Effect,
	DynamicSlot,
	InlineSlot,
	DynamicInclude,
	InlineInclude,
	LetBlock,
	IfBlock,
	EachBlock,
	TransformBlock,
	TemplateFunc,
	JSFunc,
};
