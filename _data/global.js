const moment = require('moment');

module.exports = {
	dateReadable: date => moment(date).format('MMMM Do, YYYY'),
	dateReadableShort: date => moment(date).format('Do MMM YYYY'),
	dateHtml: date => moment(date).toISOString(),
};
