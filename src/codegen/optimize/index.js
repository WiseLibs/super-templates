'use strict';
const bake = require('./bake');
const merge = require('./merge');

module.exports = (rootTemplate) => {
	bake(rootTemplate);
	merge(rootTemplate);
	return rootTemplate;
};
