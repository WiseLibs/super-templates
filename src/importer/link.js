'use strict';
const { ast } = require('../parser');

/*
	Within all included ASTs, links all template parameters with their
	respective bindings and links all slots with their respective section
	content. Multiple IncludeNodes can reference the same AST, so each linked
	node can reference multiple places; one for each acting IncludeNode.
 */

module.exports = (rootAST) => {
	const allNames = findAllNames(rootAST);
	const visited = new Set();
	const rootContext = {
		includeNode: null,
		bindings: new Map(),
		sections: new Map(),
	};

	(function linkNames(theAST, ctx) {
		(function walk(nodes) {
			for (const node of nodes) {
				if (node instanceof ast.LetNode) {
					if (!node.js) {
						if (!ctx.includeNode) error.rootParameter(node);
						const binding = ctx.bindings.get(node.name);
						node.refs.set(ctx.includeNode, binding);
					}
				} else if (node instanceof ast.SlotNode) {
					const sectionNodes = ctx.sections.get(node.name);
					if (sectionNodes) {
						node.refs.set(ctx.includeNode, sectionNodes);
					}
				} else if (node instanceof ast.IncludeNode) {
					if (!visited.has(node)) {
						visited.add(node);
						linkNames(node.ref, createContext(node));
					}
				}
				walk(node.children);
			}
		})(theAST);
	})(rootAST, rootContext);

	function createContext(includeNode) {
		const { parameterNames, slotNames } = allNames.get(includeNode.ref);

		const bindings = new Map();
		const missingParameters = new Set(parameterNames);
		for (const binding of includeNode.bindings) {
			if (bindings.has(binding.name)) error.duplicateParameter(binding);
			if (!parameterNames.has(binding.name)) error.parameterNotDefined(binding);
			bindings.set(binding.name, binding);
			missingParameters.delete(binding.name);
		}
		if (missingParameters.size) {
			error.missingParameter(includeNode, [...missingParameters]);
		}

		const sections = findSections(includeNode, slotNames);
		if (slotNames.has('')) {
			sections.set('', includeNode.children);
		} else {
			const contentSource = findContent(includeNode.children);
			if (contentSource) error.noDefaultSlot(includeNode, contentSource);
		}

		return { includeNode, bindings, sections };
	}
};

// Finds all template parameter names and slot names within all included ASTs.
function findAllNames(rootAST) {
	const allNames = new Map();

	(function findNames(theAST) {
		const parameterNames = new Set();
		const slotNames = new Set();
		allNames.set(theAST, { parameterNames, slotNames });

		(function walk(nodes) {
			for (const node of nodes) {
				if (node instanceof ast.LetNode) {
					if (!node.js) parameterNames.add(node.name);
				} else if (node instanceof ast.SlotNode) {
					slotNames.add(node.name);
				} else if (node instanceof ast.IncludeNode) {
					if (!allNames.has(node.ref)) findNames(node.ref);
				}
				walk(node.children);
			}
		})(theAST);
	})(rootAST);

	return allNames;
}

// Finds all explicit sections passed to an IncludeNode.
function findSections(includeNode, allowedNames) {
	const sections = new Map();

	(function walk(nodes) {
		for (const node of nodes) {
			if (node instanceof ast.SectionNode) {
				if (sections.has(node.name)) {
					error.duplicateSection(node);
				}
				if (!allowedNames.has(node.name)) {
					error.sectionNotDefined(node);
				}
				sections.set(node.name, node.children);
			} else if (node instanceof ast.LetNode) {
				walk(node.children);
			}
		}
	})(includeNode.children);

	return sections;
}

// Returns a Source object for the first actual content within the given AST,
// besides section blocks and whitespace/comments.
const NOT_WHITESPACE = /[^\x09\x0b\x0c\ufeff\x0a\x0d\u2028\u2029\p{Space_Separator}]/u;
function findContent(nodes) {
	for (const node of nodes) {
		if (node instanceof ast.LiteralNode) {
			const index = node.source.string().search(NOT_WHITESPACE);
			if (index !== -1) {
				return node.source.file.at(node.source.start + index, 1);
			}
		} else if (node instanceof ast.LetNode) {
			const contentSource = findContent(node.children);
			if (contentSource) return contentSource;
		} else if (!(node instanceof ast.SectionNode)) {
			return node.source.file.at(node.source.start, 1);
		}
	}
	return null;
}

// Possible error messages.
const error = {
	rootParameter(node) {
		node.source.error('Root template cannot have template parameters').throw();
	},
	missingParameter(node, missing) {
		const names = missing.map(name => `'${name}'`).join(', ');
		const plural = missing.length > 1 ? 's:' : '';
		node.source.error(`Missing template parameter${plural} ${names}`).throw();
	},
	duplicateParameter(binding) {
		binding.source.error(`Duplicate template parameter '${binding.name}'`).throw();
	},
	parameterNotDefined(binding) {
		binding.source.error(`Template parameter '${binding.name}' is not defined`).throw();
	},
	duplicateSection(node) {
		node.source.error(`Duplicate section '${node.name}'`).throw();
	},
	sectionNotDefined(node) {
		node.source.error(`Section '${node.name}' is not defined`).throw();
	},
	noDefaultSlot(node, contentSource) {
		node.source
			.error('\'include\' block contains content but no default slot is defined')
			.source(contentSource, 'content here')
			.throw();
	},
};
