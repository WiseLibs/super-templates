'use strict';
const { ast } = require('../parser');

/*
	Validates all included ASTs. Each IncludeNode is also given references to
	the sections that were passed to it (both explicitly and implicitly).
 */

module.exports = (rootAST) => {
	const allASTs = new Map();

	(function validateAST(theAST) {
		allASTs.set(theAST, findNames(theAST, theAST === rootAST));

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
function findNames(theAST, isRootAST) {
	const parameterNames = new Set();
	const slotNames = new Set();

	(function walk(nodes) {
		for (const node of nodes) {
			if (node instanceof ast.LetNode) {
				if (!node.js) {
					if (isRootAST) error.rootParameter(node);
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
	for (const child of includeNode.children) {
		if (child instanceof ast.SectionNode) {
			if (sections.has(child.name)) error.duplicateSection(child);
			if (!slotNames.has(child.name)) error.sectionNotDefined(child);
			sections.set(child.name, child);
		}
	}
	if (slotNames.has('')) {
		sections.set('', new ast.SectionNode(includeNode.source, '', includeNode.children));
	} else {
		const contentSource = findContent(includeNode.children);
		if (contentSource) error.noDefaultSlot(includeNode, contentSource);
	}

	includeNode.sections = [...sections.values()];
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
