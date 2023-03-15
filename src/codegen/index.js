'use strict';
const lib = require('./shared/lib');

exports.sync = require('./sync');
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