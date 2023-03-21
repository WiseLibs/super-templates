'use strict';
const FT = require('../.');

async function createTemplate(content) {
	const filename = await createTempFile(content);
	const compiledTemplate = await FT.compile(filename, { syncOnly: true });
	return FT.create(compiledTemplate);
}

describe('basic features', function () {
	it('renders literals', async function () {
		const template = await createTemplate('foobar');
		expect(template()).to.equal('foobar');
	});
	it('renders expressions', async function () {
		const template = await createTemplate('foo{{"!".repeat(2)}}bar');
		expect(template()).to.equal('foo!!bar');
	});
	it('escapes expressions', async function () {
		const template = await createTemplate('foo{{"&<>\\"\'"}}bar');
		expect(template()).to.equal('foo&amp;&lt;&gt;&quot;&#x27;bar');
	});
	it('renders injected expressions', async function () {
		const template = await createTemplate('foo{{UNSAFE_INJECT "&<>\\"\'"}}bar');
		expect(template()).to.equal('foo&<>"\'bar');
	});
	it('invokes effects', async function () {
		let calledFoo = 0;
		global.foo = () => { calledFoo += 1; };
		try {
			const template = await createTemplate('foo{{effect foo()}}bar{{effect foo()}}');
			expect(template()).to.equal('foobar');
		} finally {
			delete global.foo;
		}
		expect(calledFoo).to.equal(2);
	});
	it('ignores comments', async function () {
		const template = await createTemplate('foo{{!"!".repeat(2)}}bar');
		expect(template()).to.equal('foobar');
	});
	it('ignores extended comments', async function () {
		const template = await createTemplate('foo{{!--}} hi }}--}}bar');
		expect(template()).to.equal('foobar');
	});
	it('ignores nested comments', async function () {
		const template = await createTemplate('foo{{!one{{!--two{{!--nested--}}three--}}four}}bar');
		expect(template()).to.equal('foobar');
	});
	it('renders "let" blocks', async function () {
		const template = await createTemplate('foo{{let thing: 123}}{{thing.toString(16)}}{{end}}bar');
		expect(template()).to.equal('foo7bbar');
	});
	it('renders "if" blocks', async function () {
		let template = await createTemplate('foo{{if true}}baz{{end}}bar');
		expect(template()).to.equal('foobazbar');
		template = await createTemplate('foo{{if false}}baz{{end}}bar');
		expect(template()).to.equal('foobar');
	});
	it('renders "if-else" chains', async function () {
		let template = await createTemplate('foo{{if true}}baz{{else}}qux{{end}}bar');
		expect(template()).to.equal('foobazbar');
		template = await createTemplate('foo{{if false}}baz{{else}}qux{{end}}bar');
		expect(template()).to.equal('fooquxbar');
	});
	it('renders "if-else-if" chains', async function () {
		let template = await createTemplate('foo{{if false}}baz{{else if true}}qux{{end}}bar');
		expect(template()).to.equal('fooquxbar');
		template = await createTemplate('foo{{if ""}}baz{{else if 0}}qux{{else}}lol{{end}}bar');
		expect(template()).to.equal('foololbar');
	});
	it('renders "each" blocks', async function () {
		const template = await createTemplate('foo {{each x: [1, 2, 3]}}{{x}} {{end}}bar');
		expect(template()).to.equal('foo 1 2 3 bar');
	});
	it('renders "each-else" chains', async function () {
		let template = await createTemplate('foo {{each x: [1, 2, 3]}}{{x}} {{else}}hi {{end}}bar');
		expect(template()).to.equal('foo 1 2 3 bar');
		template = await createTemplate('foo {{each x: []}}{{x}} {{else}}hi {{end}}bar');
		expect(template()).to.equal('foo hi bar');
	});
	it('provides "each" block enumeration indices', async function () {
		const template = await createTemplate('foo {{each x, i: [10, 20, 30]}}{{x}},{{i}} {{end}}bar');
		expect(template()).to.equal('foo 10,0 20,1 30,2 bar');
	});
	it('renders "transform" blocks', async function () {
		const template = await createTemplate('foo{{let x: 123}}{{transform __block + __block}}({{x * 10}}){{end}}{{end}}bar');
		expect(template()).to.equal('foo(1230)(1230)bar');
	});
	it('renders "include" tags', async function () {
		const filename = await createTempFile('{{let foo}}My name is {{foo}}.{{end}}');
		const template = await createTemplate(`Hello! {{> ${JSON.stringify(filename)} with foo: 'Bob'}}`);
		expect(template()).to.equal('Hello! My name is Bob.');
	});
	it('renders "include" blocks', async function () {
		const filename = await createTempFile('{{let foo}}My name is {{foo}}.{{end}}');
		const template = await createTemplate(`Hello! {{include ${JSON.stringify(filename)} with foo: 'Bob'}}  {{end}}`);
		expect(template()).to.equal('Hello! My name is Bob.');
	});
	it('renders "slot" tags', async function () {
		const filename = await createTempFile('({{slot}})[{{slot brackets}}]({{slot}})');
		const template = await createTemplate(`Hello! {{include ${JSON.stringify(filename)}}}normal{{section brackets}}square{{end}}{{end}}`);
		expect(template()).to.equal('Hello! (normal)[square](normal)');
	});
});
