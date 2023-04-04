'use strict';
const ST = require('../.');

async function createTemplate(content, options = { syncOnly: true }) {
	const filename = await createTempFile(content);
	const compiledTemplate = await ST.compile(filename, options);
	return ST.create(compiledTemplate);
}

async function createAsyncTemplate(content) {
	const template = await createTemplate(content, { syncOnly: false });
	return async () => {
		const output = [];
		for await (const str of template()) output.push(str);
		return output.join('');
	};
}

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

describe('execution semantics', function () {
	describe('sync templates', function () {
		it('evaluates "let" variables regardless of whether they are used', async function () {
			let calledFoo = 0;
			global.foo = () => ++calledFoo;
			try {
				let template = await createTemplate('foo{{let x: foo()}}{{if 2 - 2}}{{x}}{{end}}{{end}}bar');
				expect(template()).to.equal('foobar');
				expect(calledFoo).to.equal(1);
				template = await createTemplate('foo{{let x: foo()}}{{if 2 + 2}}{{x}}{{end}}{{end}}bar');
				expect(template()).to.equal('foo2bar');
				expect(calledFoo).to.equal(2);
			} finally {
				delete global.foo;
			}
		});
		it('evaluates "include" bindings regardless of whether they are used', async function () {
			let calledFoo = 0;
			global.foo = () => ++calledFoo;
			try {
				let filename = await createTempFile('foo{{let x}}{{if 2 - 2}}{{x}}{{end}}{{end}}bar');
				let template = await createTemplate(`{{> ${JSON.stringify(filename)} with x: foo()}}`);
				expect(template()).to.equal('foobar');
				expect(calledFoo).to.equal(1);
				filename = await createTempFile('foo{{let x}}{{if 2 + 2}}{{x}}{{end}}{{end}}bar');
				template = await createTemplate(`{{> ${JSON.stringify(filename)} with x: foo()}}`);
				expect(template()).to.equal('foo2bar');
				expect(calledFoo).to.equal(2);
			} finally {
				delete global.foo;
			}
		});
		it('only evaluates "let" variables once', async function () {
			let calledFoo = 0;
			global.foo = () => ++calledFoo;
			try {
				const template = await createTemplate('foo{{let x: foo()}}{{x * 2}}{{x * 2}}{{let y: 0}}{{x * 2}}{{end}}{{end}}bar');
				expect(template()).to.equal('foo222bar');
			} finally {
				delete global.foo;
			}
			expect(calledFoo).to.equal(1);
		});
		it('only evaluates "include" bindings once', async function () {
			let calledFoo = 0;
			global.foo = () => ++calledFoo;
			try {
				const filename = await createTempFile('{{let x}}The value is {{x * 2}}{{x * 2}}. {{end}}{{let x}}Yup, still {{x * 2}}{{x * 2}}.{{end}}');
				const template = await createTemplate(`Hello! {{include ${JSON.stringify(filename)} with x: foo()}}{{end}}`);
				expect(template()).to.equal('Hello! The value is 22. Yup, still 22.');
			} finally {
				delete global.foo;
			}
			expect(calledFoo).to.equal(1);
		});
	});
	describe('async templates', function () {
		before(function () {
			global.sleep = sleep;
		});
		after(function () {
			delete global.sleep;
		});

		it('renders async expressions', async function () {
			let template = await createAsyncTemplate('foo{{Promise.resolve(123)}}bar');
			expect(await template()).to.equal('foo123bar');
			template = await createAsyncTemplate('foo{{5 + (await Promise.resolve(123))}}bar');
			expect(await template()).to.equal('foo128bar');
		});
		it('renders async injected expressions', async function () {
			const template = await createAsyncTemplate('foo{{UNSAFE_INJECT (await Promise.resolve("&<>\\"\'"))}}bar');
			expect(await template()).to.equal('foo&<>"\'bar');
		});
		it('renders async "let" blocks', async function () {
			let template = await createAsyncTemplate('foo{{let thing: sleep(5).then(() => 123)}}{{thing.toString(16)}}{{end}}bar');
			expect(await template()).to.equal('foo7bbar');
			template = await createAsyncTemplate('{{let thing: await sleep(5).then(() => 123)}}foo{{thing.toString(16)}}bar{{end}}');
			expect(await template()).to.equal('foo7bbar');
		});
		it('renders async "if" blocks', async function () {
			let template = await createAsyncTemplate('foo{{if sleep(5).then(() => false)}}baz{{end}}bar');
			expect(await template()).to.equal('foobar');
			template = await createAsyncTemplate('foo{{if await sleep(5).then(() => false)}}baz{{end}}bar');
			expect(await template()).to.equal('foobar');
			template = await createAsyncTemplate('foo{{if sleep(5).then(() => true)}}baz{{else}}{{Promise.reject(new Error("should not occur!"))}}{{end}}bar');
			expect(await template()).to.equal('foobazbar');
		});
		it('renders async "if-else-if" chains', async function () {
			let template = await createAsyncTemplate('foo{{if Promise.resolve(false)}}baz{{else if sleep(5).then(() => false)}}qux{{end}}bar');
			expect(await template()).to.equal('foobar');
			template = await createAsyncTemplate('foo{{if false}}baz{{else if sleep(5).then(() => true)}}qux{{end}}bar');
			expect(await template()).to.equal('fooquxbar');
		});
		it('renders async "each" blocks', async function () {
			const template = await createAsyncTemplate('foo {{each x: Promise.resolve([1, (await sleep(5).then(() => 2)), 3])}}{{x}} {{end}}bar');
			expect(await template()).to.equal('foo 1 2 3 bar');
		});
		it('renders async iterables in "each" blocks', async function () {
			this.slow(200);
			global.myAsyncGenerator = async function* () {
				for (const value of [1, 2, 3]) {
					await sleep(10);
					yield value;
				}
			};
			try {
				const template = await createAsyncTemplate('foo {{each x: myAsyncGenerator()}}{{x * 2}} {{end}}bar');
				expect(await template()).to.equal('foo 2 4 6 bar');
			} finally {
				delete global.myAsyncGenerator;
			}
		});
		it('provides async "each" block enumeration indices', async function () {
			let template = await createAsyncTemplate('foo {{each x, i: Promise.resolve([10, 20, 30])}}{{sleep(5).then(() => x)}},{{i * 2}} {{end}}bar');
			expect(await template()).to.equal('foo 10,0 20,2 30,4 bar');
			template = await createAsyncTemplate('foo {{each x, i: Promise.resolve([10, 20, 30])}}{{effect sleep(5)}}{{x}},{{i}} {{end}}bar');
			expect(await template()).to.equal('foo 10,0 20,1 30,2 bar');
			template = await createAsyncTemplate('foo {{each x, i: [10, 20, 30]}}{{if sleep(10).then(() => true)}}{{x}},{{i}} {{end}}{{end}}bar');
			expect(await template()).to.equal('foo 10,0 20,1 30,2 bar');
		});
		it('renders async "transform" blocks', async function () {
			let template = await createAsyncTemplate('foo{{let x: 123}}{{transform Promise.resolve(__block + __block)}}({{x * (await sleep(5).then(() => 10))}}){{end}}{{end}}bar');
			expect(await template()).to.equal('foo(1230)(1230)bar');
			template = await createAsyncTemplate('foo{{let x: 123}}{{transform (await Promise.resolve(__block + __block)) + "!"}}({{x * (await sleep(5).then(() => 10))}}){{end}}{{end}}bar');
			expect(await template()).to.equal('foo(1230)(1230)!bar');
		});
		it('renders "include" blocks with async bindings', async function () {
			const filename = await createTempFile('{{let foo}}My name is {{foo}}.{{end}}');
			let template = await createAsyncTemplate(`Hello! {{include ${JSON.stringify(filename)} with foo: Promise.resolve('Bob')}}  {{end}}`);
			expect(await template()).to.equal('Hello! My name is Bob.');
			template = await createAsyncTemplate(`Hello! {{include ${JSON.stringify(filename)} with foo: (await Promise.resolve('Bob') + 'by')}}  {{end}}`);
			expect(await template()).to.equal('Hello! My name is Bobby.');
		});
		it('renders "slot" tags for async sections', async function () {
			const filename = await createTempFile('({{slot}})[{{slot brackets}}]({{slot}})');
			const template = await createAsyncTemplate(`Hello! {{include ${JSON.stringify(filename)}}}normal{{Promise.resolve('!')}}{{section brackets}}square{{(await Promise.resolve('!')) + '!'}}{{end}}{{end}}`);
			expect(await template()).to.equal('Hello! (normal!)[square!!](normal!)');
		});
		it('does not evaluate "let" variables unless they are used', async function () {
			let calledFoo = 0;
			global.foo = () => Promise.resolve(++calledFoo);
			try {
				let template = await createAsyncTemplate('foo{{let x: foo()}}{{if Promise.resolve(2 - 2)}}{{x}}{{end}}{{end}}bar');
				expect(await template()).to.equal('foobar');
				expect(calledFoo).to.equal(0);
				template = await createAsyncTemplate('foo{{let x: foo()}}{{if Promise.resolve(2 + 2)}}{{x}}{{end}}{{end}}bar');
				expect(await template()).to.equal('foo1bar');
				expect(calledFoo).to.equal(1);
			} finally {
				delete global.foo;
			}
		});
		it('does not evaluate "include" bindings unless they are used', async function () {
			let calledFoo = 0;
			global.foo = () => Promise.resolve(++calledFoo);
			try {
				let filename = await createTempFile('foo{{let x}}{{if Promise.resolve(2 - 2)}}{{x}}{{end}}{{end}}bar');
				let template = await createAsyncTemplate(`{{> ${JSON.stringify(filename)} with x: foo()}}`);
				expect(await template()).to.equal('foobar');
				expect(calledFoo).to.equal(0);
				filename = await createTempFile('foo{{let x}}{{if Promise.resolve(2 + 2)}}{{x}}{{end}}{{end}}bar');
				template = await createAsyncTemplate(`{{> ${JSON.stringify(filename)} with x: foo()}}`);
				expect(await template()).to.equal('foo1bar');
				expect(calledFoo).to.equal(1);
			} finally {
				delete global.foo;
			}
		});
		it('only evaluates "let" variables once', async function () {
			let calledFoo = 0;
			global.foo = () => Promise.resolve(++calledFoo);
			try {
				const template = await createAsyncTemplate('foo{{let x: foo()}}{{x * 2}}{{x * 2}}{{let y: 0}}{{x * 2}}{{end}}{{end}}bar');
				expect(await template()).to.equal('foo222bar');
			} finally {
				delete global.foo;
			}
			expect(calledFoo).to.equal(1);
		});
		it('only evaluates "include" bindings once', async function () {
			let calledFoo = 0;
			global.foo = () => Promise.resolve(++calledFoo);
			try {
				const filename = await createTempFile('{{let x}}The value is {{x * 2}}{{x * 2}}. {{end}}{{let x}}Yup, still {{x * 2}}{{x * 2}}.{{end}}');
				const template = await createAsyncTemplate(`Hello! {{include ${JSON.stringify(filename)} with x: foo()}}{{end}}`);
				expect(await template()).to.equal('Hello! The value is 22. Yup, still 22.');
			} finally {
				delete global.foo;
			}
			expect(calledFoo).to.equal(1);
		});
	});
});
