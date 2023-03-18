'use strict';
const lib = require('./lib');
const generate = require('./generate');

exports.sync = (rootAST) => generate(rootAST);
exports.createFunction = (code) => {
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
