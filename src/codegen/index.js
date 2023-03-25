'use strict';
const lib = require('./lib');
const generate = require('./generate');
const syncTarget = require('./targets/sync');
const asyncTarget = require('./targets/async');

exports.sync = (rootAST) => generate(rootAST, syncTarget);
exports.async = (rootAST) => generate(rootAST, asyncTarget);

exports.createFunction = (code, helpers) => {
	if (typeof code !== 'string' || !code.startsWith('"use strict";')) {
		throw new TypeError('Expected argument to be a compiled template');
	}
	if (helpers != null && typeof helpers !== 'object') {
		throw new TypeError('Expected helpers to be an object');
	}

	return new Function(
		'normalize',
		'createWriter',
		'createAsyncIterable',
		'createAsyncStorage',
		'Scope',
		'AsyncScope',
		'memo',
		'trace',
		'traceAsync',
		'helpers',
		code
	)(
		lib.normalize,
		lib.createWriter,
		lib.createAsyncIterable,
		lib.createAsyncStorage,
		lib.Scope,
		lib.AsyncScope,
		lib.memo,
		lib.trace,
		lib.traceAsync,
		Object.assign({}, helpers)
	);
};
