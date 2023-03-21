'use strict';
const bake = require('./bake');
const bubble = require('./bubble');
const merge = require('./merge');

module.exports = (rootTemplate) => {
	bake(rootTemplate);
	bubble(rootTemplate);
	merge(rootTemplate);
	return rootTemplate;
};
