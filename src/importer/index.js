'use strict';
const fs = require('fs/promises');
const path = require('path');
const importTemplate = require('./import');

exports.import = async (filename, options = {}) => {
	if (typeof filename !== 'string') {
		throw new TypeError('Expected filename to be a string');
	}

	const {
		resolve = defaultResolve,
		load = defaultLoad,
	} = options;

	if (typeof resolve !== 'function') {
		throw new TypeError('Expected options.resolve to be a function');
	}
	if (typeof load !== 'function') {
		throw new TypeError('Expected options.load to be a function');
	}

	return importTemplate(filename, resolve, load);
};

function defaultResolve(includeString, resolveFrom) {
	return path.resolve(resolveFrom, includeString);
}

function defaultLoad(filename) {
	return fs.readFile(filename, 'utf8');
}
