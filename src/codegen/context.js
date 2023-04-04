'use strict';
const { Source, LineMap } = require('../source');
const asm = require('./asm');

/*
	The context passed around to each code-generating function. It is used to
	generate unique names for entities within the generated code, and to
	calculate source locations for runtime stack traces.
 */

module.exports = class CodegenContext {
	constructor() {
		this._lineMaps = new Map();
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
		let lineMap = this._lineMaps.get(source.file);
		if (!lineMap) {
			lineMap = new LineMap(source.file);
			this._lineMaps.set(source.file, lineMap);
		}
		const lineNumber = lineMap.find(source);
		return `${source.file.filename}:${lineNumber}`;
	}
};
