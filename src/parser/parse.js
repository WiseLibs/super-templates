'use strict';
const src = require('../source');
const ast = require('./ast');
const Parser = require('./parser');

const NOT_WHITESPACE = /[^\x09\x0b\x0c\ufeff\x0a\x0d\u2028\u2029\p{Space_Separator}]/u;
const WHITESPACE = /[\x09\x0b\x0c\ufeff\x0a\x0d\u2028\u2029\p{Space_Separator}]+/yu;
const IDENT = /[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/yu;

/*
	Generates an AST by parsing the given File object.
 */

module.exports = (file) => {
	if (!(file instanceof src.File)) {
		throw new TypeError('Expected file to be a File object');
	}
	const parser = new Parser(file);
	const nodes = [];
	while (!parser.isDone()) {
		if (parser.acceptUntil('{{')) {
			nodes.push(literal(parser));
		}
		if (parser.accept('{{')) {
			if (!comment(parser)) {
				const node = interpolation(parser);
				if (node instanceof ast.SectionNode) {
					node.source.error('Illegal \'section\' block').throw();
				}
				if (node instanceof ast.ElseNode) {
					node.source.error('Illegal \'else\' token').throw();
				}
				if (node instanceof ast.EndNode) {
					node.source.error('Illegal \'end\' token').throw();
				}
				nodes.push(node);
			}
		}
	}
	return nodes;
};

function blockContent(parser, strictBlock, allowSections = false, allowElse = false) {
	const nodes = [];
	for (;;) {
		if (parser.acceptUntil('{{')) {
			nodes.push(literal(parser));
		}
		if (parser.accept('{{')) {
			if (!comment(parser)) {
				const node = interpolation(parser, allowSections);
				if (node instanceof ast.SectionNode && !allowSections) {
					node.source.error('Illegal \'section\' block').throw();
				}
				if (node instanceof ast.ElseNode) {
					if (allowElse) {
						nodes.push(node);
						break;
					}
					node.source.error('Illegal \'else\' token').throw();
				}
				if (node instanceof ast.EndNode) {
					break;
				}
				nodes.push(node);
			}
		} else if (strictBlock) {
			strictBlock.error('Block is not terminated', 'block starts here').throw();
		} else {
			break;
		}
	}
	return nodes;
}

function comment(parser) {
	if (parser.accept('!--')) {
		while (!parser.isDone() && !parser.accept('--}}')) {
			parser.acceptUntil(/\{\{!|--\}\}/g);
			if (parser.accept('{{')) {
				comment(parser);
			}
		}
		return true;
	}
	if (parser.accept('!')) {
		while (!parser.isDone() && !parser.accept('}}')) {
			parser.acceptUntil(/\{\{!|\}\}/g);
			if (parser.accept('{{')) {
				comment(parser);
			}
		}
		return true;
	}
	return false;
}

function interpolation(parser, allowSections = false) {
	const start = parser.getCaptured();
	if (parser.accept('>')) return includeTag(parser, start);
	if (parser.accept(IDENT)) {
		const keyword = parser.getCaptured().string();
		if (keyword === 'let') return letBlock(parser, start, allowSections);
		if (keyword === 'if') return ifBlock(parser, start);
		if (keyword === 'each') return eachBlock(parser, start);
		if (keyword === 'transform') return transformBlock(parser, start);
		if (keyword === 'include') return includeBlock(parser, start);
		if (keyword === 'section') return sectionBlock(parser, start);
		if (keyword === 'slot') return slotTag(parser, start);
		if (keyword === 'end') return endTag(parser, start);
		if (keyword === 'else') return elseTag(parser, start);
		if (keyword === 'ignore') return expression(parser, start, 'ignore');
		if (keyword === 'UNSAFE_INJECT') return expression(parser, start, 'inject');
		parser.undo();
	}
	return expression(parser, start, 'normal');
}

function letBlock(parser, start, allowSections = false) {
	parser.accept(WHITESPACE);
	parser.expect(IDENT);
	const name = parser.getCaptured().string();
	parser.accept(WHITESPACE);
	let js;
	if (parser.accept(':')) {
		parser.accept(WHITESPACE);
		parser.expectJavaScript();
		js = parser.getCaptured();
		parser.accept(WHITESPACE);
	}
	parser.expect('}}');
	const end = parser.getCaptured();
	const source = start.to(end);
	const strictBlock = parser.isPreamble() ? null : source;
	const children = blockContent(parser, strictBlock, allowSections);
	return new ast.LetNode(source, js, name, children);
}

function ifBlock(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	parser.expectJavaScript();
	const js = parser.getCaptured();
	parser.accept(WHITESPACE);
	parser.expect('}}');
	const end = parser.getCaptured();
	const source = start.to(end);
	const trueBranch = blockContent(parser, source, false, true);
	const falseBranch = elseClause(parser, source, trueBranch);
	return new ast.IfNode(source, js, trueBranch, falseBranch);
}

function elseClause(parser, source, prevBranch) {
	if (prevBranch[prevBranch.length - 1] instanceof ast.ElseNode) {
		const elseNode = prevBranch.pop();
		if (elseNode.js) {
			const trueBranch = blockContent(parser, source, false, true);
			const falseBranch = elseClause(parser, source, trueBranch);
			return [new ast.IfNode(elseNode.source, elseNode.js, trueBranch, falseBranch)];
		} else {
			return blockContent(parser, source);
		}
	} else {
		return [];
	}
}

function eachBlock(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	parser.expect(IDENT);
	const name = parser.getCaptured().string();
	let indexName;
	parser.accept(WHITESPACE);
	if (parser.accept(',')) {
		parser.accept(WHITESPACE);
		parser.expect(IDENT);
		indexName = parser.getCaptured().string();
		parser.accept(WHITESPACE);
	}
	parser.expect(':');
	parser.accept(WHITESPACE);
	parser.expectJavaScript();
	const js = parser.getCaptured();
	parser.accept(WHITESPACE);
	parser.expect('}}');
	const end = parser.getCaptured();
	const source = start.to(end);
	const children = blockContent(parser, source);
	return new ast.EachNode(source, js, name, indexName, children);
}

function transformBlock(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	parser.expectJavaScript();
	const js = parser.getCaptured();
	parser.accept(WHITESPACE);
	parser.expect('}}');
	const end = parser.getCaptured();
	const source = start.to(end);
	const children = blockContent(parser, source);
	return new ast.TransformNode(source, js, children);
}

function includeBlock(parser, start) {
	parser.accept(WHITESPACE);
	const parsedJS = parser.expectJavaScript();
	const js = parser.getCaptured();
	if (parsedJS.type !== 'Literal' || typeof parsedJS.value !== 'string') {
		js.error('Include path must be a string literal').throw();
	}
	parser.accept(WHITESPACE);
	const bindings = includeBindings(parser);
	parser.expect('}}');
	const end = parser.getCaptured();
	const source = start.to(end);
	const strictBlock = parser.isPreamble() ? null : source;
	const children = blockContent(parser, strictBlock, true);
	return new ast.IncludeNode(source, js, parsedJS.value, bindings, children);
}

function includeBindings(parser) {
	const bindings = [];
	while (parser.accept(IDENT)) {
		if (parser.getCaptured().string() !== 'with') {
			parser.getCaptured().error('Unexpected identifier').throw();
		}
		parser.accept(WHITESPACE);
		parser.expect(IDENT);
		const source = parser.getCaptured();
		const name = source.string();
		parser.accept(WHITESPACE);
		parser.expect(':');
		parser.accept(WHITESPACE);
		parser.expectJavaScript();
		const js = parser.getCaptured();
		parser.accept(WHITESPACE);
		bindings.push({ source, name, js });
	}
	return bindings;
}

function sectionBlock(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	parser.expect(IDENT);
	const name = parser.getCaptured().string();
	parser.accept(WHITESPACE);
	parser.expect('}}');
	const end = parser.getCaptured();
	const source = start.to(end);
	const children = blockContent(parser, source);
	return new ast.SectionNode(source, name, children);
}

function slotTag(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	let name = '';
	if (parser.accept(IDENT)) {
		name = parser.getCaptured().string();
		parser.accept(WHITESPACE);
	}
	parser.expect('}}');
	const end = parser.getCaptured();
	return new ast.SlotNode(start.to(end), name);
}

function endTag(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	parser.expect('}}');
	const end = parser.getCaptured();
	return new ast.EndNode(start.to(end));
}

function elseTag(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	let js;
	if (parser.accept(IDENT)) {
		if (parser.getCaptured().string() !== 'if') {
			parser.getCaptured().error('Unexpected identifier').throw();
		}
		parser.accept(WHITESPACE);
		parser.expectJavaScript();
		js = parser.getCaptured();
		parser.accept(WHITESPACE);
	}
	parser.expect('}}');
	const end = parser.getCaptured();
	return new ast.ElseNode(start.to(end), js);
}

function includeTag(parser, start) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	const parsedJS = parser.expectJavaScript();
	const js = parser.getCaptured();
	if (parsedJS.type !== 'Literal' || typeof parsedJS.value !== 'string') {
		js.error('Include path must be a string literal').throw();
	}
	parser.accept(WHITESPACE);
	const bindings = includeBindings(parser);
	parser.expect('}}');
	const end = parser.getCaptured();
	return new ast.IncludeNode(start.to(end), js, parsedJS.value, bindings, []);
}

function expression(parser, start, type) {
	parser.endPreamble();
	parser.accept(WHITESPACE);
	parser.expectJavaScript();
	const js = parser.getCaptured();
	parser.accept(WHITESPACE);
	parser.expect('}}');
	const end = parser.getCaptured();
	return new ast.ExpressionNode(start.to(end), js, type);
}

function literal(parser) {
	const source = parser.getCaptured();
	if (parser.isPreamble() && NOT_WHITESPACE.test(source.string())) {
		parser.endPreamble();
	}
	return new ast.LiteralNode(source);
}
