'use strict';
const { tk } = require('../lexer');

/*
	Transforms a stream of tokens by cleaning up cosmetic whitespace.
 */

module.exports = (tokens) => {
	return collapseBlocks(stripCommentLines(normalizeIndents(tokens)));
};

function* normalizeIndents(tokens) {
	const stack = [];
	let indents = undefined;
	let hadIndent = false;
	let buffer = [];

	for (const token of tokens) {
		if (!indents) {
			yield token;
			if (token.isBlock) {
				indents = [];
			}
		} else {
			if (hadIndent) {
				if (token instanceof tk.NewlineToken
					|| token instanceof tk.EndToken
					|| token instanceof tk.ElseToken
				) {
					// Ignore indentations that are immediately followed by a
					// newline, "end" token, or "else" token.
					indents.pop();
				}
			}

			hadIndent = false;
			buffer.push(token);

			if (token instanceof tk.IndentationToken) {
				indents.push(token);
				hadIndent = true;
			} else if (token.isBlock) {
				stack.push(indents);
				indents = [];
			} else if (token instanceof tk.EndToken) {
				// Dedent the contents of each block as much as possible,
				// without affecting the relative indentations of lines within
				// the block.
				dedent(indents);
				indents = stack.pop();
				if (!indents) {
					yield* buffer;
					buffer = [];
				}
			}
		}
	}

	// The end-of-file is treated like an infinite number of "end" tokens.
	while (indents) {
		dedent(indents);
		indents = stack.pop();
	}
	yield* buffer;
}

function* stripCommentLines(tokens) {
	let line = [];
	let wantStrip = false;
	let canStrip = true;

	for (const token of tokens) {
		line.push(token);

		if (token instanceof tk.NewlineToken) {
			if (canStrip && wantStrip) {
				// If a line only contains comments and nothing else (except
				// whitespace), strip away the entire line.
				line = [];
			}
			yield* line;
			line = [];
			wantStrip = false;
			canStrip = true;
		} else if (canStrip) {
			if (!isCosmetic(token)) {
				canStrip = false;
			} else if (!wantStrip && token instanceof tk.CommentToken) {
				wantStrip = true;
			}
		}
	}

	yield* line;
}

function* collapseBlocks(tokens) {
	let line = [];
	let blockAt = -1;
	let eachBlock = null;

	for (const token of tokens) {
		if (token instanceof tk.NewlineToken) {
			if (blockAt >= 0) {
				if (eachBlock) {
					// If the only thing following an "each" block's opening
					// token is cosmetic tokens followed by a newline, annotate
					// the block with a line separator.
					eachBlock.lineSeparator = token.source.string();
				}
				// If the only thing following a block's opening token is
				// cosmetic tokens followed by a newline, strip all such tokens,
				// including the newline.
				line = line.slice(0, blockAt + 1);
				blockAt = -1;
				eachBlock = null;
			} else {
				yield* line;
				line = [token];
			}
			continue;
		}

		if (token.isBlock) {
			blockAt = line.length;
			eachBlock = token instanceof tk.EachBlockToken ? token : null;
		} else if (token instanceof tk.EndToken) {
			if (line.every(isCosmetic)) {
				// If the only thing before an "end" token is cosmetic tokens,
				// strip all such tokens, including the previous newline.
				if (line[0] instanceof tk.NewlineToken) {
					// The stripped newline may be needed during parsing.
					token.collapsedNewline = line[0];
				}
				line = [];
			}
			blockAt = -1;
			eachBlock = null;
		} else if (token instanceof tk.ElseToken) {
			// An "else" token acts like both an "end" token and a block-opener.
			if (line.every(isCosmetic)) {
				if (line[0] instanceof tk.NewlineToken) {
					// The stripped newline may be needed during parsing.
					token.collapsedNewline = line[0];
				}
				line = [];
			}
			blockAt = line.length;
			eachBlock = null;
		} else if (blockAt >= 0) {
			if (!isCosmetic(token)) {
				blockAt = -1;
				eachBlock = null;
			}
		}

		line.push(token);
	}

	yield* line;
}

function dedent(tokens) {
	if (!tokens.length) {
		return;
	}

	const values = tokens.map(x => [...x.getValue()]);
	let charIndex = 0;
	let trim = 0;
	let nextChar;

	outer:
	while (nextChar = values[0][charIndex]) {
		for (let i = 1; i < values.length; ++i) {
			// Don't dedent when the type of indentation differs between lines.
			if (nextChar !== values[i][charIndex]) {
				break outer;
			}
		}
		charIndex += 1;
		trim += nextChar.length; // Support multi-character-width unicode
	}

	if (trim) {
		for (const token of tokens) {
			token.trim += trim;
		}
	}
}

function isCosmetic(token) {
	if (token instanceof tk.NewlineToken) return true;
	if (token instanceof tk.IndentationToken) return true;
	if (token instanceof tk.CommentToken) return true;
	if (token instanceof tk.LiteralToken && !token.hasContent()) return true;
	return false;
}
