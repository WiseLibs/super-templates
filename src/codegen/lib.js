'use strict';
const { Readable } = require('stream');
const { nextTick } = process;

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
	dynamic indentation and dynamic newlines, and passes the resulting strings
	to the given output callback.
 */

const NOT_NEWLINE = /[^\x0a\x0d\u2028\u2029]/u;
const INDENT_SPOTS = /(?:\x0d\x0a|[\x0a\x0d\u2028\u2029])(?![\x0a\x0d\u2028\u2029]|$)/gu;
function createWriter(output, state) {
	return (str) => {
		if (!str) return;
		if (NOT_NEWLINE.test(str)) {
			if (state.pendingNewline) {
				output(state.pendingNewline);
				state.pendingNewline = '';
				state.atNewline = true;
			}
			if (state.indentation) {
				if (state.atNewline && !isNewlineChar(str[0])) {
					output(state.indentation);
				}
				str = str.replace(INDENT_SPOTS, '$&' + state.indentation);
			}
			state.atNewline = isNewlineChar(str[str.length - 1]);
			state.blockHasContent = true;
		} else {
			state.atNewline = true;
		}
		output(str);
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
	Creates an async iterable iterator from the given initializer function.
	The initializer function is called immediately, with an "output()" function
	passed as its only parameter, which is used to populate the async iterator.
	The initializer function may return a promise, indicating when no more
	output will be generated. Unlike an async generator, this async iterator
	generates output eagerly, buffering output until it is consumed.

	If the optimizeStrings argument is true, then all values written to the
	async iterator must be strings, and any strings written within the same
	event loop tick will be joined together, reducing the total number of
	strings yielded by the async iterator.
 */

function createAsyncIterable(initializer, optimizeStrings = false) {
	const requests = []; // TODO: this could be optimized by using a real queue data structure
	let buffer = []; // TODO: this could be optimized by using a real queue data structure
	let tickBuffer = [];
	let isEnded = false;
	let isDone = false;
	let isError = false;
	let error;

	const onWrite = (value) => {
		if (!isEnded) {
			if (optimizeStrings) {
				if (tickBuffer.push(value) === 1) {
					nextTick(onTick);
				}
			} else if (requests.length) {
				requests.shift()({ value, done: false });
			} else {
				buffer.push(value);
			}
		}
	};
	const onFinish = () => {
		if (!buffer.length && !tickBuffer.length) {
			isDone = true;
			while (requests.length) {
				requests.shift()({ value: undefined, done: true });
			}
		}
	};
	const onCancel = (err) => {
		if (!isDone) {
			buffer = [];
			tickBuffer = [];
			isEnded = true;
			isDone = true;
			isError = true;
			error = err;
			while (requests.length) {
				requests.shift()(Promise.reject(err));
			}
		}
	};
	const onTick = () => {
		if (!isDone) {
			let value;
			if (tickBuffer.length === 1) {
				value = tickBuffer.pop();
			} else {
				value = tickBuffer.join('');
				tickBuffer = [];
			}
			if (requests.length) {
				requests.shift()({ value, done: false });
				isEnded && onFinish();
			} else {
				buffer.push(value);
			}
		}
	};

	new Promise(r => r(initializer(onWrite))).then(() => {
		if (!isDone) {
			isEnded = true;
			onFinish();
		}
	}, onCancel);

	return {
		next: () => new Promise((resolve, reject) => {
			if (!isDone) {
				if (buffer.length) {
					resolve({ value: buffer.shift(), done: false });
					isEnded && onFinish();
				} else {
					requests.push(resolve);
				}
			} else if (!isError) {
				resolve({ value: undefined, done: true });
			} else {
				reject(error);
			}
		}),
		return: (value) => {
			onCancel(new Error('Operation cancelled'));
			return Promise.resolve({ value, done: true });
		},
		throw: (err) => {
			onCancel(err);
			return Promise.reject(err);
		},
		[Symbol.asyncIterator]() {
			return this;
		},
	};
}

/*
	Creates a storage container designed for storing promises. Promises that are
	stored will not trigger unhandledRejection errors. When a promise is
	retrieved from storage ("consumed"), it will also be deleted from storage.
	The "clear()" method consumes all stored promises, and returns the
	"Promise.all()" of all such promises.
 */

function createAsyncStorage() {
	const storage = new Map();
	return {
		store: (name, promise) => {
			promise.catch(() => {}); // Prevent unhandledRejection
			storage.set(name, promise);
		},
		consume: (name) => {
			const promise = storage.get(name);
			storage.delete(name);
			return promise;
		},
		clear: () => {
			if (!storage.size) return Promise.resolve();
			const promise = Promise.all([...storage.values()]);
			storage.clear();
			return promise;
		},
	};
}

/*
	Scope is used to store/manage a compiled template's variable context.
 */

class Scope {
	constructor() {
		this._vars = Object.create(null);
	}
	with(name, value) {
		const scope = new (this.constructor)();
		Object.assign(scope._vars, this._vars);
		scope._vars[name] = value;
		return scope;
	}
	withTwo(name1, value1, name2, value2) {
		const scope = new (this.constructor)();
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
	AsyncScope is the same as Scope, except that its stores getter functions,
	instead of storing the variable values themselves. Its "use()" method is
	asynchronous (allowing getter functions to be asynchronous), and it only
	returns the variables that are requested in the arguments.
 */

class AsyncScope extends Scope {
	async use(...names) {
		const values = await Promise.all(names.map(name => this._vars[name]()));
		const vars = Object.create(null);
		for (let i = 0; i < names.length; ++i) {
			vars[names[i]] = values[i];
		}
		return vars;
	}
}

/*
	Wraps the given getter function such that it will only be called once, and
	all invocations after the first will just return the first returned value.
 */

function memo(getter) {
	let cache;
	return () => {
		if (cache === undefined) {
			cache = getter();
		}
		return cache;
	};
}

/*
	Creates a Map of template parameter bindings, given a parameters object.
	A source location is needed in case of error.
 */

function getParameters(parameters, parameterNames, location) {
	const bindings = new Map();
	const missing = new Set(parameterNames);
	if (parameters != null) {
		for (const name of parameterNames) {
			if ({}.hasOwnProperty.call(parameters, name)) {
				bindings.set(name, parameters[name]);
				missing.delete(name);
			}
		}
	}
	if (missing.size) {
		const names = [...missing].map(name => `'${name}'`).join(', ');
		const plural = missing.size > 1 ? 's:' : '';
		throw createRuntimeError(new Error(`Template needs parameter${plural} ${names}`), location);
	}
	return bindings;
}

/*
	Wraps the given function (which should be an embedded/compiled JSFunc) so
	that if it throws an exception, a nicely formatted error will be raised,
	containing the source location.
 */

function trace(fn, location) {
	return function st_trace(arg) {
		try {
			return fn(arg);
		} catch (err) {
			throw createRuntimeError(err, location, true);
		}
	};
}

function traceAsync(fn, location) {
	return async function st_trace(arg) {
		try {
			return await fn(arg);
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
			.filter(str => /^\s+at (?!st_(?:\d|trace))/.test(str))
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
	createAsyncIterable,
	createAsyncStorage,
	Scope,
	AsyncScope,
	memo,
	getParameters,
	trace,
	traceAsync,
	escapeHTML,
};
