'use strict';
const ST = require('../.');

describe('utilities', function () {
	describe('escape()', function () {
		it('escapes HTML/XML special characters', function () {
			expect(ST.escape('')).to.equal('');
			expect(ST.escape('foo&<>"\'bar')).to.equal('foo&amp;&lt;&gt;&quot;&#x27;bar');
		});
		it('only accepts string input', function () {
			expect(() => ST.escape(123)).to.throw();
			expect(() => ST.escape(0)).to.throw();
			expect(() => ST.escape(undefined)).to.throw();
		});
	});
});
