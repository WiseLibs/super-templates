'use strict';
const { Source } = require('../source/source');

/*
	These nodes form the AST of a functional template file.
 */

class Node {
	constructor(source) {
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}
		this.source = source;
	}
}

class LiteralNode extends Node {}

class ExpressionNode extends Node {
	constructor(source, js, type) {
		super(source);
		if (!(js instanceof Source)) {
			throw new TypeError('Expected js to be a Source object');
		}
		if (type !== 'normal' && type !== 'ignore' && type !== 'inject') {
			throw new TypeError('Expected type to be "normal", "ignore", or "inject"');
		}
		this.js = js;
		this.type = type;
	}
}

class LetNode extends Node {
	constructor(source, js, name, children) {
		super(source);
		if (js !== undefined && !(js instanceof Source)) {
			throw new TypeError('Expected js to be a Source object');
		}
		if (!(name instanceof Source)) {
			throw new TypeError('Expected name to be a Source object');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.js = js;
		this.name = name;
		this.children = children;
	}
}

class IfNode extends Node {
	constructor(source, js, trueBranch, falseBranch) {
		super(source);
		if (!(js instanceof Source)) {
			throw new TypeError('Expected js to be a Source object');
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
		this.children = [...this.trueBranch, ...this.falseBranch];
	}
}

class EachNode extends Node {
	constructor(source, js, name, indexName, children) {
		super(source);
		if (!(js instanceof Source)) {
			throw new TypeError('Expected js to be a Source object');
		}
		if (!(name instanceof Source)) {
			throw new TypeError('Expected name to be a Source object');
		}
		if (indexName !== undefined && !(indexName instanceof Source)) {
			throw new TypeError('Expected indexName to be a Source object');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.js = js;
		this.name = name;
		this.indexName = indexName;
		this.children = children;
	}
}

class EvalNode extends Node {
	constructor(source, js, children) {
		super(source);
		if (!(js instanceof Source)) {
			throw new TypeError('Expected js to be a Source object');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.js = js;
		this.children = children;
	}
}

class IncludeNode extends Node {
	constructor(source, js, path, bindings, children) {
		super(source);
		if (!(js instanceof Source)) {
			throw new TypeError('Expected js to be a Source object');
		}
		if (typeof path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}
		if (!Array.isArray(bindings)) {
			throw new TypeError('Expected bindings to be an array');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.js = js;
		this.path = path;
		this.bindings = bindings;
		this.children = children;
	}
}

class SlotNode extends Node {
	constructor(source, name) {
		super(source);
		if (name !== undefined && !(name instanceof Source)) {
			throw new TypeError('Expected name to be a Source object');
		}
		this.name = name;
	}
}

class SectionNode extends Node {
	constructor(source, name, children) {
		super(source);
		if (!(name instanceof Source)) {
			throw new TypeError('Expected name to be a Source object');
		}
		if (!Array.isArray(children)) {
			throw new TypeError('Expected children to be an array');
		}
		this.name = name;
		this.children = children;
	}
}

class ElseNode extends Node {
	constructor(source, js) {
		super(source);
		if (js !== undefined && !(js instanceof Source)) {
			throw new TypeError('Expected js to be a Source object');
		}
		this.js = js;
	}
}

class EndNode extends Node {}

module.exports = {
	Node,
	LiteralNode,
	ExpressionNode,
	LetNode,
	IfNode,
	EachNode,
	EvalNode,
	IncludeNode,
	SlotNode,
	SectionNode,
	ElseNode,
	EndNode,
};
