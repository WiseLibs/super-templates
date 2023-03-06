'use strict';
const fs = require('fs/promises');
const path = require('path');
const importAST = require('./import');
const link = require('./link');

/*
	Returns the combined ASTs of all imported template files, starting with one
	initial filename, and links all slots and template parameters in all
	included templates.
 */

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

	const nodes = await importAST(filename, resolve, load);
	link(nodes);
	return nodes;
};

function defaultResolve(includeString, resolveFrom) {
	return path.resolve(path.dirname(resolveFrom), includeString);
}

function defaultLoad(filename) {
	return fs.readFile(filename, 'utf8');
}
