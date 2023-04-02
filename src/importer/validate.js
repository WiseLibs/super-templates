'use strict';
const { ast } = require('../parser');

/*
	Validates all included ASTs. Each IncludeNode is also given references to
	the sections that were passed to it (both explicitly and implicitly).
 */

module.exports = (rootAST) => {
	const allASTs = new Map();

	(function validateAST(theAST) {
		allASTs.set(theAST, findNames(theAST));

		(function walk(nodes) {
			for (const node of nodes) {
				if (node instanceof ast.IncludeNode) {
					if (!allASTs.has(node.ref)) {
						validateAST(node.ref);
					}
					validateInclude(node, allASTs.get(node.ref));
				}
				walk(node.children);
			}
		})(theAST);
	})(rootAST);
};

// Finds the names of all template parameters and slots within the given AST.
function findNames(theAST) {
	const parameterNames = new Set();
	const slotNames = new Set();

	(function walk(nodes) {
		for (const node of nodes) {
			if (node instanceof ast.LetNode) {
				if (!node.js) {
					parameterNames.add(node.name);
				}
			} else if (node instanceof ast.SlotNode) {
				slotNames.add(node.name);
			}
			walk(node.children);
		}
	})(theAST);

	return { parameterNames, slotNames };
}

// Returns a Source object for the first actual content within the given AST,
// besides section blocks and whitespace/comments.
function findContent(nodes) {
	for (const node of nodes) {
		if (node instanceof ast.LiteralNode) {
			const index = node.indexOfContent();
			if (index !== -1) {
				return node.source.file.at(index, 1);
			}
		} else if (node instanceof ast.LineNode || node instanceof ast.LetNode) {
			const contentSource = findContent(node.children);
			if (contentSource) return contentSource;
		} else if (!(node instanceof ast.SectionNode)) {
			return node.source.file.at(node.source.start, 1);
		}
	}
	return null;
}

// Finds all SectionNodes within the given AST, which is expected to be the
// children of an IncludeNode.
function* findSections(nodes) {
	for (const node of nodes) {
		if (node instanceof ast.SectionNode) {
			yield node;
		} else if (node instanceof ast.LineNode || node instanceof ast.LetNode) {
			yield* findSections(node.children);
		}
	}
}

// Validates the given IncludeNode and links all secitons passed to it.
function validateInclude(includeNode, { parameterNames, slotNames }) {
	const givenParameters = new Set();
	const missingParameters = new Set(parameterNames);
	for (const binding of includeNode.bindings) {
		if (givenParameters.has(binding.name)) error.duplicateParameter(binding);
		if (!parameterNames.has(binding.name)) error.parameterNotDefined(binding);
		givenParameters.add(binding.name);
		missingParameters.delete(binding.name);
	}
	if (missingParameters.size) {
		error.missingParameter(includeNode, [...missingParameters]);
	}

	const sections = new Map();
	for (const node of findSections(includeNode.children)) {
		if (sections.has(node.name)) error.duplicateSection(node);
		if (!slotNames.has(node.name)) error.sectionNotDefined(node);
		sections.set(node.name, node);
	}
	if (slotNames.has('')) {
		sections.set('', new ast.SectionNode({ source: includeNode.source, name: '' }, includeNode.children));
	} else {
		const contentSource = findContent(includeNode.children);
		if (contentSource) error.noDefaultSlot(includeNode, contentSource);
	}

	includeNode.sections = [...sections.values()];
}

// Possible error messages.
const error = {
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
