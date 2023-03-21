'use strict';
const importer = require('./importer');
const codegen = require('./codegen');

exports.compile = async (filename, options = {}) => {
	if (options.syncOnly) {
		return codegen.sync(await importer.import(filename, options));
	} else {
		throw new TypeError('Async templates not yet implemented');
	}
};

exports.create = (compiledTemplateCode) => {
	return codegen.createFunction(compiledTemplateCode);
};
