'use strict';
const { File } = require('super-sources');
const { parse, ast } = require('../parser');

/*
	Returns the combined ASTs of all imported template files, starting with one
	initial filename.
 */

module.exports = (initialFilename, resolve, load) => {
	return new Promise((res, rej) => {
		const memo = new Map();
		const includes = new Map();
		let pending = 0;
		let aborted = false;

		function importFile(filename, includeNode) {
			let promise = memo.get(filename);
			if (!promise) {
				pending += 1;
				promise = importNewFile(filename, includeNode?.js.source);
				promise.then(onDone, onError);
				memo.set(filename, promise);
			}
			if (includeNode) {
				let arr = includes.get(filename);
				if (!arr) includes.set(filename, arr = []);
				arr.push(includeNode);
			}
		}

		function importNewFile(filename, source) {
			const processIncludes = (nodes) => {
				for (const node of nodes) {
					if (node instanceof ast.IncludeNode) {
						resolveInclude(node, filename);
					}
					processIncludes(node.children);
				}
			};

			return new Promise(r => r(load(filename)))
				.then((content) => {
					if (aborted) return [];
					const nodes = parse(new File(filename, content));
					processIncludes(nodes);
					return nodes;
				}, (err) => {
					if (source && err != null && (err.syscall || err.expose)) {
						if (err.code === 'ENOENT') {
							source.error(`Could not resolve '${filename}'`).throw();
						}
						source.error(err.message).throw();
					}
					throw err;
				});
		}

		function resolveInclude(includeNode, resolveFrom) {
			pending += 1;
			return new Promise(r => r(resolve(includeNode.path, resolveFrom)))
				.then((filename) => {
					if (aborted) return;
					importFile(filename, includeNode);
				}, (err) => {
					if (err != null && err.expose) {
						includeNode.js.source.error(err.message).throw();
					}
					throw err;
				})
				.then(onDone, onError);
		}

		async function annotateIncludes() {
			for (const [filename, includeNodes] of includes) {
				const theAST = await memo.get(filename);
				for (const includeNode of includeNodes) {
					includeNode.ref = theAST;
				}
			}
		}

		function onDone() {
			if (!aborted && --pending === 0) {
				res(annotateIncludes().then(() => memo.get(initialFilename)));
			}
		}

		function onError(err) {
			aborted = true;
			rej(err);
		}

		importFile(initialFilename);
	});
};
