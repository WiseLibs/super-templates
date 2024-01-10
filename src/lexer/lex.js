'use strict';
const walkJS = require('acorn-walk');
const { File } = require('super-sources');
const Tokenizer = require('./tokenizer');
const tk = require('./tk');

const WHITESPACE = /[\x09\x0b\x0c\ufeff\x0a\x0d\u2028\u2029\p{Space_Separator}]+/yu;
const NEWLINE = /\x0d\x0a|[\x0a\x0d\u2028\u2029]/yu;
const INDENTATION = /[\x09\x0b\x0c\ufeff\p{Space_Separator}]+/yu;
const IDENTIFIER = /[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/yu;
const STOP_LITERAL = /\{\{|[\x0a\x0d\u2028\u2029]/gu;

/*
	Generates a stream of tokens by lexing the given File object.
 */

module.exports = function* lex(file) {
	if (!(file instanceof File)) {
		throw new TypeError('Expected file to be a File object');
	}

	const tzr = new Tokenizer(file);
	yield indentation(tzr);

	while (!tzr.isDone()) {
		if (tzr.acceptUntil(STOP_LITERAL)) {
			yield new tk.LiteralToken(tzr.getCaptured());
		}
		if (tzr.acceptRe(NEWLINE)) {
			yield new tk.NewlineToken(tzr.getCaptured());
			yield indentation(tzr);
		} else if (tzr.acceptStr('{{')) {
			yield interpolation(tzr);
		}
	}
};

function indentation(tzr) {
	if (tzr.acceptRe(INDENTATION)) {
		return new tk.IndentationToken(tzr.getCaptured(), 0);
	} else {
		const source = tzr.getCaptured();
		return new tk.IndentationToken(source, source.end - source.start);
	}
}

function interpolation(tzr) {
	const start = tzr.getCaptured();
	if (tzr.acceptRe(IDENTIFIER)) {
		switch (tzr.getCaptured().string()) {
			case 'end': return endMarker(tzr, start);
			case 'let': return letBlock(tzr, start);
			case 'if': return ifBlock(tzr, start);
			case 'else': return elseMarker(tzr, start);
			case 'each': return eachBlock(tzr, start);
			case 'transform': return transformBlock(tzr, start);
			case 'include': return includeBlock(tzr, start);
			case 'section': return sectionBlock(tzr, start);
			case 'slot': return slotTag(tzr, start);
			case 'effect': return expressionTag(tzr, start, 'effect');
			case 'UNSAFE_INJECT': return expressionTag(tzr, start, 'inject');
		}
		tzr.undo();
	} else {
		if (tzr.acceptStr('>')) return includeTag(tzr, start);
		if (tzr.acceptStr('!')) return comment(tzr, start);
	}
	return expressionTag(tzr, start, 'normal');
}

function endMarker(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.EndToken(start.to(end));
}

function letBlock(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	tzr.expectRe(IDENTIFIER);
	const name = tzr.getCaptured().string();
	tzr.acceptRe(WHITESPACE);
	let js = null;
	if (tzr.acceptStr(':')) {
		tzr.acceptRe(WHITESPACE);
		js = jsExpression(tzr);
		tzr.acceptRe(WHITESPACE);
	}
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.LetBlockToken(start.to(end), js, name);
}

function ifBlock(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	const js = jsExpression(tzr);
	tzr.acceptRe(WHITESPACE);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.IfBlockToken(start.to(end), js);
}

function elseMarker(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	let js = null;
	if (tzr.acceptRe(IDENTIFIER)) {
		if (tzr.getCaptured().string() !== 'if') {
			tzr.getCaptured().error('Unexpected identifier').throw();
		}
		tzr.acceptRe(WHITESPACE);
		js = jsExpression(tzr);
		tzr.acceptRe(WHITESPACE);
	}
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.ElseToken(start.to(end), js);
}

function eachBlock(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	tzr.expectRe(IDENTIFIER);
	const nameSource = tzr.getCaptured();
	const name = nameSource.string();
	let indexName = null;
	tzr.acceptRe(WHITESPACE);
	if (tzr.acceptStr(',')) {
		tzr.acceptRe(WHITESPACE);
		tzr.expectRe(IDENTIFIER);
		const indexNameSource = tzr.getCaptured();
		indexName = indexNameSource.string();
		if (name === indexName) {
			nameSource.to(indexNameSource).error('Duplicate identifiers').throw();
		}
		tzr.acceptRe(WHITESPACE);
	}
	tzr.expectStr(':');
	tzr.acceptRe(WHITESPACE);
	const js = jsExpression(tzr);
	tzr.acceptRe(WHITESPACE);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.EachBlockToken(start.to(end), js, name, indexName);
}

function transformBlock(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	const js = jsExpression(tzr);
	tzr.acceptRe(WHITESPACE);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.TransformBlockToken(start.to(end), js);
}

function includeBlock(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	const [js, path] = jsIncludePath(tzr);
	tzr.acceptRe(WHITESPACE);
	const bindings = includeBindings(tzr);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.IncludeBlockToken(start.to(end), js, path, bindings);
}

function includeBindings(tzr) {
	const bindings = [];
	while (tzr.acceptRe(IDENTIFIER)) {
		if (tzr.getCaptured().string() !== 'with') {
			tzr.getCaptured().error('Unexpected identifier').throw();
		}
		tzr.acceptRe(WHITESPACE);
		tzr.expectRe(IDENTIFIER);
		const source = tzr.getCaptured();
		const name = source.string();
		tzr.acceptRe(WHITESPACE);
		tzr.expectStr(':');
		tzr.acceptRe(WHITESPACE);
		const js = jsExpression(tzr);
		tzr.acceptRe(WHITESPACE);
		bindings.push(new tk.Binding(source, name, js));
	}
	return bindings;
}

function sectionBlock(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	tzr.expectRe(IDENTIFIER);
	const name = tzr.getCaptured().string();
	tzr.acceptRe(WHITESPACE);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.SectionBlockToken(start.to(end), name);
}

function slotTag(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	let name = '';
	if (tzr.acceptRe(IDENTIFIER)) {
		name = tzr.getCaptured().string();
		tzr.acceptRe(WHITESPACE);
	}
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.SlotTagToken(start.to(end), name);
}

function includeTag(tzr, start) {
	tzr.acceptRe(WHITESPACE);
	const [js, path] = jsIncludePath(tzr);
	tzr.acceptRe(WHITESPACE);
	const bindings = includeBindings(tzr);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.IncludeTagToken(start.to(end), js, path, bindings);
}

function expressionTag(tzr, start, type) {
	tzr.acceptRe(WHITESPACE);
	const js = jsExpression(tzr);
	tzr.acceptRe(WHITESPACE);
	tzr.expectStr('}}');
	const end = tzr.getCaptured();
	return new tk.ExpressionTagToken(start.to(end), type, js);
}

function comment(tzr, start) {
	if (tzr.acceptStr('--')) {
		while (!tzr.isDone() && !tzr.acceptStr('--}}')) {
			tzr.acceptUntil(/\{\{!|--\}\}/g);
			if (tzr.acceptStr('{{!')) {
				comment(tzr);
			}
		}
	} else {
		while (!tzr.isDone() && !tzr.acceptStr('}}')) {
			tzr.acceptUntil(/\{\{!|\}\}/g);
			if (tzr.acceptStr('{{!')) {
				comment(tzr);
			}
		}
	}
	if (start) {
		const end = tzr.getCaptured();
		return new tk.CommentToken(start.to(end));
	}
}

function jsExpression(tzr) {
	const parsedJS = tzr.expectJavaScript();
	const source = tzr.getCaptured();
	const names = getJSNames(parsedJS);
	return new tk.EmbeddedJS(source, names);
}

function jsIncludePath(tzr) {
	const parsedJS = tzr.expectJavaScript();
	const source = tzr.getCaptured();
	if (parsedJS.type !== 'Literal' || typeof parsedJS.value !== 'string') {
		source.error('Include path must be a string literal').throw();
	}
	return [new tk.EmbeddedJS(source, new Set()), parsedJS.value];
}

// Returns the names of all referenced identifiers within the given JS AST.
function getJSNames(parsedJS) {
	const names = new Set();
	walkJS.simple(parsedJS, {
		Identifier(node) {
			names.add(node.name);
		},
		AssignmentExpression(node) {
			if (node.left.type === 'Identifier') {
				names.add(node.left.name);
			}
		},
	});
	return names;
}
