const {DateTime} = require('luxon');

module.exports = {
	dateToFormat(date, format) {
		return DateTime.fromJSDate(date, {zone: 'utc'}).toFormat(String(format));
	},

	dateToISO(date) {
		return DateTime.fromJSDate(date, {zone: 'utc'}).toISO({
			includeOffset: false,
			suppressMilliseconds: true,
		});
	},

	obfuscate(string_) {
		const chars = [];
		for (let i = string_.length - 1; i >= 0; i--) {
			chars.unshift(['&#', string_[i].charCodeAt(), ';'].join(''));
		}

		return chars.join('');
	},
};
