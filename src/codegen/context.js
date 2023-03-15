'use strict';
const { Source, LineMap } = require('../source');
const { tk } = require('../lexer');
const { ast } = require('../parser');

/*
	The context passed around to each code-generating function, used to generate
	unique names for entities within the generated code.
 */

module.exports = class CodegenContext {
	constructor() {
		this._lineMaps = new Map();
		this._names = new Map();
		this._nextId = 0;
	}

	name(obj) {
		if (!(obj instanceof ast.Node || obj instanceof tk.EmbeddedJS || Array.isArray(obj))) {
			throw new TypeError('Expected obj to be a Node object, EmbeddedJS object, or array');
		}
		let name = this._names.get(obj);
		if (name === undefined) {
			name = `ft_${this._nextId++}`;
			this._names.set(obj, name);
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
