'use strict';
const { File } = require('super-sources');
const { tk } = require('../lexer');
const Parser = require('./parser');
const ast = require('./ast');

/*
	Generates an AST by parsing the given File object.
 */

module.exports = (file) => {
	if (!(file instanceof File)) {
		throw new TypeError('Expected file to be a File object');
	}

	const parser = new Parser(file);
	parser.state.isPreamble = true;
	parser.state.elseToken = null;

	return blockContent(parser, null, true);
};

function blockContent(parser, blockToken, allowEOF = false, allowElse = false, allowSections = false) {
	let line = new ast.LineNode(firstLineSource(parser, blockToken), false);
	let lineIsBlank = true;
	const lines = [line];

	let token;
	loop: while (token = parser.next()) {
		switch (token.constructor) {
			case tk.EndToken: {
				if (!blockToken) {
					token.source.error('Illegal \'end\' token').throw();
				}
				parser.state.isPreamble = false;
				break loop;
			}

			case tk.ElseToken: {
				if (!allowElse) {
					token.source.error('Illegal \'else\' token').throw();
				}
				parser.state.elseToken = token;
				break loop;
			}

			case tk.NewlineToken: {
				if (lineIsBlank) {
					// If the line is blank, treat the newline as a literal.
					if (line.isNewline) {
						line.children.push(new ast.LiteralNode(line));
						line.source = token.source;
					} else {
						line.children.push(new ast.LiteralNode(token));
					}
				} else {
					// If the line is not blank, insert a new line.
					line = new ast.LineNode(token.source, true);
					lineIsBlank = true;
					lines.push(line);
				}
				break;
			}

			case tk.IndentationToken: {
				line.indentation = token.getValue();
				break;
			}

			case tk.LiteralToken: {
				const node = new ast.LiteralNode(token);
				if (parser.state.isPreamble && node.hasContent()) {
					parser.state.isPreamble = false;
				}
				lineIsBlank = false;
				line.children.push(node);
				break;
			}

			case tk.ExpressionTagToken: {
				if (token.type !== 'effect') {
					parser.state.isPreamble = false;
				}
				lineIsBlank = false;
				line.children.push(new ast.ExpressionNode(token));
				break;
			}

			case tk.SlotTagToken: {
				lineIsBlank = false;
				parser.state.isPreamble = false;
				line.children.push(new ast.SlotNode(token));
				break;
			}

			case tk.IncludeTagToken: {
				lineIsBlank = false;
				parser.state.isPreamble = false;
				line.children.push(new ast.IncludeNode(token, []));
				break;
			}

			case tk.IncludeBlockToken: {
				lineIsBlank = false;
				line.children.push(new ast.IncludeNode(token, blockContent(parser, token, parser.state.isPreamble, false, true)));
				break;
			}

			case tk.IfBlockToken: {
				lineIsBlank = false;
				parser.state.isPreamble = false;
				const trueBranch = blockContent(parser, token, false, true);
				const falseBranch = elseClause(parser, false);
				line.children.push(new ast.IfNode(token, trueBranch, falseBranch));
				break;
			}

			case tk.EachBlockToken: {
				lineIsBlank = false;
				parser.state.isPreamble = false;
				const trueBranch = blockContent(parser, token, false, true);
				const falseBranch = elseClause(parser, true);
				line.children.push(new ast.EachNode(token, trueBranch, falseBranch));
				break;
			}

			case tk.TransformBlockToken: {
				lineIsBlank = false;
				parser.state.isPreamble = false;
				line.children.push(new ast.TransformNode(token, blockContent(parser, token)));
				break;
			}

			case tk.LetBlockToken: {
				lineIsBlank = false;
				line.children.push(new ast.LetNode(token, blockContent(parser, token, parser.state.isPreamble)));
				break;
			}

			case tk.SectionBlockToken: {
				if (!allowSections) {
					token.source.error('Illegal \'section\' block').throw();
				}
				lineIsBlank = false;
				parser.state.isPreamble = false;
				line.children.push(new ast.SectionNode(token, blockContent(parser, token)));
				break;
			}

			case tk.CommentToken: {
				lineIsBlank = false;
				break;
			}

			default:
				throw new TypeError('Unrecognized token');
		}
	}

	// If the last line is blank, treat it as a literal.
	if (lineIsBlank) {
		if (line.isNewline) {
			const removedLine = lines.pop();
			line = lines[lines.length - 1];
			line.children.push(...removedLine.children);
			line.children.push(new ast.LiteralNode(removedLine));
		} else if (token && token.collapsedNewline) {
			// If the last line is also the first line, we have to restore a
			// newline character that got removed during beautification.
			line.children.push(new ast.LiteralNode(token.collapsedNewline));
		}
	}

	if (!token) {
		if (!allowEOF) {
			blockToken.source.error('Block is not terminated', 'block starts here').throw();
		}
		// If this block was part of the preamble, trim whitespace around it.
		trimWhitespace(lines);
	}

	return removeEmptyLines(lines);
}

function elseClause(parser, isEachBlock) {
	const token = parser.state.elseToken;
	if (token) {
		parser.state.elseToken = null;
		if (token.js) {
			if (isEachBlock) {
				token.source.error('\'each\' blocks cannot have \'else-if\' chains').throw();
			}
			const trueBranch = blockContent(parser, token, false, true);
			const falseBranch = elseClause(parser, isEachBlock);
			const line = new ast.LineNode(firstLineSource(parser, token), false);
			line.children.push(new ast.IfNode(token, trueBranch, falseBranch));
			return [line];
		} else {
			return blockContent(parser, token);
		}
	} else {
		return [];
	}
}

function firstLineSource(parser, blockToken) {
	if (blockToken) {
		return blockToken.source.file.at(blockToken.source.end, 1);
	} else {
		return parser.file.at(0, 1);
	}
}

function trimWhitespace(lines) {
	front: for (let i = 0; i < lines.length; ++i) {
		const { children } = lines[i];
		for (let j = 0; j < children.length; ++j) {
			const node = children[j];
			if (node instanceof ast.SectionNode) continue;
			if (node instanceof ast.ExpressionNode && node.type === 'effect') continue;
			if (node instanceof ast.LiteralNode && !node.hasContent()) {
				children.splice(j--, 1);
			} else {
				break front;
			}
		}
	}
	back: for (let i = lines.length - 1; i >= 0; --i) {
		const { children } = lines[i];
		for (let j = children.length - 1; j >= 0; --j) {
			const node = children[j];
			if (node instanceof ast.SectionNode) continue;
			if (node instanceof ast.ExpressionNode && node.type === 'effect') continue;
			if (node instanceof ast.LiteralNode && !node.hasContent()) {
				children.splice(j, 1);
			} else {
				break back;
			}
		}
	}
}

function removeEmptyLines(lines) {
	lines = lines.filter(line => line.children.length);
	if (lines.length) lines[0].isNewline = false;
	return lines;
}
