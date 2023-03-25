'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

async function expectError(message, promise) {
	try {
		await promise;
	} catch (err) {
		expect(err.message).to.equal(message);
		return;
	}
	throw new Error('Expected an error to be thrown');
}

describe('template validation', function () {
	it('forbids illegal "end" tokens', async function () {
		await expectError('Illegal \'end\' token', createTemplate('{{end}}'));
		await expectError('Illegal \'end\' token', createTemplate('{{if true}}foobar{{end}}{{end}}'));
	});
	it('forbids illegal "else" tokens', async function () {
		await expectError('Illegal \'else\' token', createTemplate('{{else}}'));
		await expectError('Illegal \'else\' token', createTemplate('{{let foo: x}}foobar{{else}}{{end}}'));
	});
	it('forbids illegal "section" blocks', async function () {
		const filename = await createTempFile('{{slot}}{{slot foo}}');
		await expectError('Illegal \'section\' block', createTemplate('{{section foo}}{{end}}'));
		await expectError('Illegal \'section\' block', createTemplate(`{{include ${JSON.stringify(filename)}}}{{if true}}{{section foo}}{{end}}{{end}}{{end}}`));
	});
	it('forbids unterminated "if" blocks', async function () {
		await expectError('Block is not terminated', createTemplate('{{if true}}foo'));
		await expectError('Block is not terminated', createTemplate('{{if true}}{{if true}}foo{{end}}'));
	});
	it('forbids unterminated "each" blocks', async function () {
		await expectError('Block is not terminated', createTemplate('{{each x: []}}foo'));
		await expectError('Block is not terminated', createTemplate('{{each x: []}}{{each y: []}}foo{{end}}'));
	});
	it('forbids unterminated "transform" blocks', async function () {
		await expectError('Block is not terminated', createTemplate('{{transform __block}}foo'));
		await expectError('Block is not terminated', createTemplate('{{transform __block}}{{transform __block}}foo{{end}}'));
	});
	it('forbids unterminated "section" blocks', async function () {
		const filename = await createTempFile('{{slot foo}}');
		await expectError('Block is not terminated', createTemplate(`{{include ${JSON.stringify(filename)}}}{{section foo}}`));
	});
	it('forbids unterminated "let" blocks not in the preamble', async function () {
		await expectError('Block is not terminated', createTemplate('x{{let x: 0}}'));
		await expectError('Block is not terminated', createTemplate('{{let x: 0}}x{{let x: 0}}'));
		await expectError('Block is not terminated', createTemplate('{{let x: 0}}{{end}}{{let x: 0}}'));
	});
	it('forbids unterminated "include" blocks not in the preamble', async function () {
		const filename = await createTempFile('{{slot}}');
		await expectError('Block is not terminated', createTemplate(`x{{include ${JSON.stringify(filename)}}}`));
		await expectError('Block is not terminated', createTemplate(`{{include ${JSON.stringify(filename)}}}x{{include ${JSON.stringify(filename)}}}`));
		await expectError('Block is not terminated', createTemplate(`{{include ${JSON.stringify(filename)}}}{{end}}{{include ${JSON.stringify(filename)}}}`));
	});
	it('forbids non-string-literals as "include" paths', async function () {
		const filename = await createTempFile('foo');
		await expectError('Include path must be a string literal', createTemplate(`{{include \`${filename.replace(/`/g, '\\`')}\`}}{{end}}`));
		await expectError('Include path must be a string literal', createTemplate(`{{include ${JSON.stringify(filename)} + ""}}{{end}}`));
		await expectError('Include path must be a string literal', createTemplate(`{{include (${JSON.stringify(filename)})}}{{end}}`));
		await expectError('Include path must be a string literal', createTemplate(`{{> \`${filename.replace(/`/g, '\\`')}\`}}`));
		await expectError('Include path must be a string literal', createTemplate(`{{> ${JSON.stringify(filename)} + ""}}`));
		await expectError('Include path must be a string literal', createTemplate(`{{> (${JSON.stringify(filename)})}}`));
	});
	it('forbids "else-if" chains in "each" blocks', async function () {
		await expectError('\'each\' blocks cannot have \'else-if\' chains', createTemplate('{{each x: []}}foo{{else if true}}{{end}}'));
	});
	it('forbids template parameters in root templates', async function () {
		await expectError('Root template cannot have template parameters', createTemplate('{{let x}}'));
		await expectError('Root template cannot have template parameters', createTemplate('{{let x}}{{end}}'));
	});
	it('forbids missing "include" bindings', async function () {
		const filename = await createTempFile('{{let x}}{{x}}');
		await expectError('Missing template parameter \'x\'', createTemplate(`{{include ${JSON.stringify(filename)}}}`));
		await expectError('Missing template parameter \'x\'', createTemplate(`{{> ${JSON.stringify(filename)}}}`));
	});
	it('forbids duplicate "include" bindings', async function () {
		const filename = await createTempFile('{{let x}}{{x}}');
		await expectError('Duplicate template parameter \'x\'', createTemplate(`{{include ${JSON.stringify(filename)} with x: 2 with x: 2}}`));
		await expectError('Duplicate template parameter \'x\'', createTemplate(`{{> ${JSON.stringify(filename)} with x: 2 with x: 3}}`));
	});
	it('forbids undefined "include" bindings', async function () {
		const filename = await createTempFile('{{let x}}{{x}}');
		await expectError('Template parameter \'y\' is not defined', createTemplate(`{{include ${JSON.stringify(filename)} with x: 2 with y: 2}}`));
		await expectError('Template parameter \'y\' is not defined', createTemplate(`{{> ${JSON.stringify(filename)} with x: 2 with y: 3}}`));
	});
	it('forbids duplicate sections', async function () {
		const filename = await createTempFile('{{slot foo}}');
		await expectError('Duplicate section \'foo\'', createTemplate(`{{include ${JSON.stringify(filename)}}}{{section foo}}{{end}}{{section foo}}{{end}}`));
	});
	it('forbids undefined sections', async function () {
		const filename = await createTempFile('{{slot foo}}');
		await expectError('Section \'bar\' is not defined', createTemplate(`{{include ${JSON.stringify(filename)}}}{{section foo}}{{end}}{{section bar}}{{end}}`));
	});
	it('forbids content in "include" blocks when no default slot is defined', async function () {
		const filename = await createTempFile('{{slot foo}}');
		await expectError('\'include\' block contains content but no default slot is defined', createTemplate(`{{include ${JSON.stringify(filename)}}}{{section foo}}{{end}}x`));
		await expectError('\'include\' block contains content but no default slot is defined', createTemplate(`{{include ${JSON.stringify(filename)}}}x{{section foo}}{{end}}`));
		await expectError('\'include\' block contains content but no default slot is defined', createTemplate(`{{include ${JSON.stringify(filename)}}}x`));
		await expectError('\'include\' block contains content but no default slot is defined', createTemplate(`{{include ${JSON.stringify(filename)}}}{{if true}}{{end}}`));
	});
});
