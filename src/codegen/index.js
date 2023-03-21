'use strict';
const lib = require('./lib');
const generate = require('./generate');
const syncTarget = require('./targets/sync');

exports.sync = (rootAST) => generate(rootAST, syncTarget);

exports.createFunction = (code) => {
	if (typeof code !== 'string' || !code.startsWith('"use strict";')) {
		throw new TypeError('Expected argument to be a compiled template');
	}

	return new Function(
		'normalize',
		'createWriter',
		'Scope',
		'trace',
		code
	)(
		lib.normalize,
		lib.createWriter,
		lib.Scope,
		lib.trace
	);
};
