'use strict';
const { File } = require('../source');
const { parse, ast } = require('../parser');

/*
	Returns the combined AST of all imported template files, starting with one
	initial filename.
 */

module.exports = (initialFilename, resolve, load) => {
	return new Promise((res, rej) => {
		const memo = new Map();
		let pending = 0;
		let aborted = false;

		function importFile(filename, source) {
			let cached = memo.get(filename);
			if (cached) return cached;
			pending += 1;
			const promise = importNewFile(filename, source);
			promise.then(onDone, onError);
			memo.set(filename, promise);
			return promise;
		}

		function importNewFile(filename, source) {
			const processIncludes = (nodes) => {
				for (const node of nodes) {
					if (node instanceof ast.IncludeNode) {
						node.ref = importFile(resolve(node.path, filename), node.js);
					} else if (node.children) {
						processIncludes(node.children);
					}
				}
			};

			return new Promise(r => r(load(filename)))
				.then((content) => {
					if (aborted) return [];
					const nodes = parse(new File(filename, content));
					processIncludes(nodes);
					return nodes;
				}, (err) => {
					if (source && err.syscall) {
						if (err.code = 'ENOENT') {
							source.error(`Could not resolve "${filename}"`).throw();
						}
						source.error(err.message).throw();
					}
					throw err;
				});
		}

		function onDone() {
			if (!aborted && --pending === 0) {
				res(memo.get(initialFilename).then(unwrapPromises));
			}
		}

		function onError(err) {
			aborted = true;
			rej(err);
		}

		importFile(initialFilename);
	});
};

async function unwrapPromises(nodes) {
	for (const node of nodes) {
		if (node instanceof ast.IncludeNode) {
			if (node.ref instanceof Promise) {
				node.ref = await node.ref;
				await unwrapPromises(node.ref);
			} else if (!Array.isArray(node.ref)) {
				throw new TypeError('IncludeNode ref should be an array');
			}
		} else if (node.children) {
			await unwrapPromises(node.children);
		}
	}
	return nodes;
}
