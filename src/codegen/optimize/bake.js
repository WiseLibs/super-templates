'use strict';
const asm = require('../asm');

module.exports = (rootTemplate) => {
	if (!(rootTemplate instanceof asm.TemplateFunc)) {
		throw new TypeError('Expected rootTemplate to be a TemplateFunc object');
	}

	const visited = new Set([rootTemplate]);
	rootTemplate.children = rootTemplate.children.flatMap(withState(createState()));

	function withState(state) {
		return function bake(node) {
			if (node instanceof asm.DynamicBlock) {
				const blockHasContent = state.blockHasContent;
				state.blockHasContent = false;
				node.children = node.children.flatMap(bake);
				if (blockHasContent === true) state.blockHasContent = true;
				if (!node.children.some(x => x instanceof asm.DynamicNewline)) {
					// A DynamicBlock without any DynamicNewlines is useless.
					return node.children;
				}
			} else if (node instanceof asm.DynamicNewline) {
				if (state.blockHasContent === false) {
					// We proved that the newline will not be used.
					return node.children.flatMap(bake);
				}
				if (state.blockHasContent === true) {
					if (state.pendingNewline !== '') {
						throw new TypeError('Expected no pending newline when the topmost block has content');
					}
					state.pendingNewline = node.newline;
					node.children = node.children.flatMap(bake);
					const resultingNewline = state.pendingNewline;
					state.pendingNewline = '';
					if (resultingNewline === node.newline) {
						// We proved that the newline will not be used.
						return node.children;
					}
					if (resultingNewline === '') {
						// We proved that the newline will be used.
						return [new asm.PrintLiteral(node.newline), ...node.children];
					}
				} else {
					state.pendingNewline = undefined;
					node.children = node.children.flatMap(bake);
					if (node.children.every(isNotContent)) {
						// No child node will trigger this DynamicNewline.
						return node.children;
					}
				}
			} else if (node instanceof asm.DynamicIndentation) {
				if (node.children.length !== 1) {
					throw new TypeError('Expected children length to be equal to 1');
				}
				if (node.children[0] instanceof asm.PrintLiteral) {
					const child = node.children[0];
					if (isNewline(child.content)) {
						// Newlines don't need indentation.
						return bake(child);
					}
					if (state.pendingNewline) {
						state.pendingNewline = '';
						state.atNewline = true;
					}
					if (state.atNewline === true) {
						// We proved that indentation will be used.
						child.content = node.indentation + child.content;
						return bake(child);
					}
					if (state.atNewline === false) {
						// We proved that indentation will not be used.
						return bake(child);
					}
				}
				node.children = node.children.flatMap(bake);
			} else if (node instanceof asm.PrintLiteral) {
				write(node.content, state);
			} else if (node instanceof asm.PrintExpression) {
				writeUnknown(state);
			} else if (node instanceof asm.DynamicSlot) {
				writeUnknown(state);
			} else if (node instanceof asm.InlineSlot) {
				node.children = node.children.flatMap(bake);
				if (!node.children.length) {
					// A slot with no children is useless.
					return [];
				}
			} else if (node instanceof asm.DynamicInclude) {
				writeUnknown(state);
				for (const [name, section] of node.sections) {
					node.sections.set(name, section.flatMap(
						withState(createUnknownState())
					));
				}
				if (!visited.has(node.ref)) {
					visited.add(node.ref);
					node.ref.children = node.ref.children.flatMap(
						withState(createUnknownState())
					);
				}
			} else if (node instanceof asm.InlineInclude) {
				node.children = node.children.flatMap(bake);
			} else if (node instanceof asm.LetBlock) {
				node.children = node.children.flatMap(bake);
			} else if (node instanceof asm.IfBlock) {
				const stateA = { ...state };
				const stateB = { ...state };
				node.trueBranch = node.trueBranch.flatMap(withState(stateA));
				node.falseBranch = node.falseBranch.flatMap(withState(stateB));
				mergePossibilities(stateA, stateB, state);
			} else if (node instanceof asm.EachBlock) {
				const stateA = { ...state };
				const stateB = { ...state };
				node.trueBranch = node.trueBranch.flatMap(withState(stateA));
				node.falseBranch = node.falseBranch.flatMap(withState(stateB));
				mergePossibilities(stateA, stateB, state);
			} else if (node instanceof asm.TransformBlock) {
				node.children = node.children.flatMap(withState(createState()));
				writeUnknown(state);
			} else if (!(node instanceof asm.Effect)) {
				throw new TypeError('Unrecognized ASM node');
			}
			return node;
		};
	}
};

function createState() {
	return {
		atNewline: true,
		blockHasContent: false,
		pendingNewline: '',
	};
}

function createUnknownState() {
	return {
		atNewline: undefined,
		blockHasContent: undefined,
		pendingNewline: undefined,
	};
}

function write(str, state) {
	if (isNewline(str)) {
		state.atNewline = true;
	} else {
		state.atNewline = false;
		state.blockHasContent = true;
		state.pendingNewline = '';
	}
}

function writeUnknown(state) {
	state.atNewline = undefined;
	if (state.pendingNewline) state.pendingNewline = undefined;
	if (state.blockHasContent === false) state.blockHasContent = undefined;
}

function mergePossibilities(stateA, stateB, outputState) {
	if (stateA.atNewline === stateB.atNewline) {
		outputState.atNewline = stateA.atNewline;
	} else {
		outputState.atNewline = undefined;
	}
	if (outputState.pendingNewline !== '') {
		if (stateA.pendingNewline === stateB.pendingNewline) {
			outputState.pendingNewline = stateA.pendingNewline;
		} else {
			outputState.pendingNewline = undefined;
		}
	}
	if (outputState.blockHasContent !== true) {
		if (stateA.blockHasContent === stateB.blockHasContent) {
			outputState.blockHasContent = stateA.blockHasContent;
		} else {
			outputState.blockHasContent = undefined;
		}
	}
}

function isNewline(str) {
	switch (str) {
		case '\n': return true;
		case '\r': return true;
		case '\r\n': return true;
		case '\u2028': return true;
		case '\u2029': return true;
		default: return false;
	}
}

function isNotContent(node) {
	if (node instanceof asm.PrintLiteral && isNewline(node.content)) return true;
	if (node instanceof asm.Effect) return true;
	return false;
}
