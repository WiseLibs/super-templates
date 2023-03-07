'use strict';

/*
	The context passed around to each code-generating function, used to generate
	unique names for entities within the generated code.
 */

module.exports = class CodegenContext {
	constructor() {
		this._names = new Map();
		this._nextId = 0;
	}

	name(obj) {
		if (typeof obj !== 'object' || obj === null) {
			throw new TypeError('Expected obj to be an object');
		}
		let name = this._names.get(obj);
		if (name === undefined) {
			name = `uid_${this._nextId++}`;
			this._names.set(obj, name);
		}
		return name;
	}
};
