'use strict';
const importer = require('./importer');
const codegen = require('./codegen');

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
