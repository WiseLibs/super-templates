'use strict';
const { Source } = require('super-sources');
const asm = require('./asm');

/*
	The context passed around to each code-generating function. It is used to
	generate unique names for entities within the generated code, and to
	calculate source locations for runtime stack traces.
 */

module.exports = class CodegenContext {
	constructor() {
		this._names = new Map();
		this._nextId = 0;
		this.named = [];
	}

	name(obj) {
		if (!(obj instanceof asm.ASM)) {
			throw new TypeError('Expected obj to be an ASM object');
		}
		let name = this._names.get(obj);
		if (name === undefined) {
			name = `st_${this._nextId++}`;
			this._names.set(obj, name);
			this.named.push(obj);
		}
		return name;
	}

	location(source) {
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}
		const { file } = source;
		const lineNumber = file.lineNumberAt(source.start);
		return `${file.filename}:${lineNumber}`;
	}
};
