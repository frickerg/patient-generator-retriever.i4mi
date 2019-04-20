var luxon = require('luxon');

/* Date validation */
let nothing = undefined;
let invalidDate = 'asdf';
let validDate = '2019-02-19T10:52:04.633Z';
console.log(isValidDate(nothing));
console.log(isValidDate(invalidDate));
console.log(isValidDate(validDate));

/* Timezone awareness */
let timeZoneDate1 = '2019-02-19T14:50:57.014+01:00';
let timeZoneDate2 = '2019-04-19T03:11:15.703+02:00';
console.log(timeZoneDate1 + ' -> ' + luxon.DateTime.fromISO(timeZoneDate1));
console.log(timeZoneDate2 + ' -> ' + luxon.DateTime.fromISO(timeZoneDate2))

/* Local datetime (now) */
let todayDate = getTodayDate();
console.log(todayDate + ' -> ' + todayDate.toISO())

/* Date modification */
let startOfToday = getTodayDate().set({
	hour: 0,
	minute: 0,
	second: 0,
	millisecond: 0
});
let twoMonthsAgo = getTodayDate().minus({
	months: 2
});
console.log(startOfToday + ' -> ' + startOfToday.toISO())
console.log(twoMonthsAgo + ' -> ' + twoMonthsAgo.toISO())

/* Return the current date and time as DateTime object */
function getTodayDate() {
	return luxon.DateTime.local();
}

/* Function to validate an ISO Date String */
function isValidDate(string) {
	return luxon.DateTime.fromISO(string).get('isValid');
}
