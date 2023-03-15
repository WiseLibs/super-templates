'use strict';
const File = require('./file');
const Source = require('./source');

/*
	A data structure that provides quick access to the line number of any Source
	object. It creates a sorted array of line positions, and uses binary search
	to find which line the given Source object falls within.
 */

module.exports = class LineMap {
	constructor(file) {
		if (!(file instanceof File)) {
			throw new TypeError('Expected file to be a File object');
		}

		const { content } = file;
		const data = [];
		let pos = 0;

		for (;;) {
			data.push({ pos, lineNumber: data.length + 1 });

			const index = content.indexOf('\n', pos);
			if (index >= 0) {
				pos = index + 1;
			} else {
				break;
			}
		}

		this._data = data;
	}

	find(source) {
		if (!(source instanceof Source)) {
			throw new TypeError('Expected source to be a Source object');
		}

		const data = this._data;
		const goal = source.start;
		let left = 0;
		let right = data.length - 1;

		while (left < right) {
			const center = Math.ceil((left + right) / 2);
			const guess = data[center].pos;
			if (guess > goal) {
				right = center - 1;
			} else if (guess < goal) {
				left = center;
			} else {
				left = center;
				right = center;
			}
		}

		return data[left].lineNumber;
	}
};
