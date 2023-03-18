'use strict';
const bake = require('./bake');
const merge = require('./merge');

module.exports = (rootTemplate) => {
	bake(rootTemplate);
	merge(rootTemplate);
	// TODO: merge adjacent DynamicIndentations
	// TODO: lower DynamicIndentations when all siblings are DynamicIndentations or Effects
	return rootTemplate;
};
