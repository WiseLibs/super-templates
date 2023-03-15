'use strict';
const lib = require('./lib');
const codegenSync = require('./codegen-sync');
const generate = require('./generate');

exports.sync = (rootAST) => generate(rootAST, codegenSync);
exports.createFunction = (code) => {
	return new Function(
		'normalize',
		'isNewline',
		'Scope',
		'trace',
		code
	)(
		lib.normalize,
		lib.isNewline,
		lib.Scope,
		lib.trace
	);
};
