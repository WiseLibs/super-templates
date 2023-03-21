'use strict';
const lib = require('./lib');
const generate = require('./generate');
const syncTarget = require('./targets/sync');

exports.sync = (rootAST) => generate(rootAST, syncTarget);

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
		'Scope',
		'trace',
		'helpers',
		code
	)(
		lib.normalize,
		lib.createWriter,
		lib.Scope,
		lib.trace,
		Object.assign({}, helpers)
	);
};
