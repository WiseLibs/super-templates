'use strict';
const importer = require('./importer');
const codegen = require('./codegen');
const { escapeHTML } = require('./codegen/lib');

exports.compile = async (filename, options = {}) => {
	if (options.syncOnly) {
		return codegen.sync(await importer.import(filename, options));
	} else {
		return codegen.async(await importer.import(filename, options));
	}
};

exports.create = (compiledTemplate, helpers) => {
	return codegen.createFunction(compiledTemplate, helpers);
};

exports.escape = (str) => {
	if (typeof str !== 'string') {
		throw new TypeError('Expected argument to be a string');
	}
	return escapeHTML(str);
};
