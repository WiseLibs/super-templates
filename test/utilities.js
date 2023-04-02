'use strict';
const FT = require('../.');

describe('utilities', function () {
	describe('escape()', function () {
		it('escapes HTML/XML special characters', function () {
			expect(FT.escape('')).to.equal('');
			expect(FT.escape('foo&<>"\'bar')).to.equal('foo&amp;&lt;&gt;&quot;&#x27;bar');
		});
		it('only accepts string input', function () {
			expect(() => FT.escape(123)).to.throw();
			expect(() => FT.escape(0)).to.throw();
			expect(() => FT.escape(undefined)).to.throw();
		});
	});
});
