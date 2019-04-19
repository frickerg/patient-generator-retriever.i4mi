const rp = require('request-promise');
const path = require('path');
const luxon = require('luxon');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(generateFileName('database'));

const requested_length = 100;

const config_bfh = {
	uri: 'http://patient-generator.i4mi.bfh.ch/patient/get',
	headers: {
		'User-Agent': 'Request-Promise'
	},
	json: true
};

const config_mockaroo = {
	uri: 'https://my.api.mockaroo.com/lep_demonstrator_patient_mock.json?key=e7b8fb30',
	headers: {
		'User-Agent': 'Request-Promise'
	},
	json: true
};

run().then((result) => {
	if (result[0].length === requested_length && result[1].length === requested_length) {
		writeToDatabase(result[0], result[1]);
	}
});

async function run() {
	// Retrieve BFH Data
	let bfhArray = [];
	while (bfhArray.length < requested_length) {
		let promiseBFH = new Promise((resolve, reject) => {
			return resolve(retrieveBFHData());
		});

		let resolved = await promiseBFH;
		if (resolved != JSON.stringify({})) {
			console.log(resolved);
			bfhArray.push(resolved);
		}
	}
	console.log(bfhArray.length);

	// Retrieve Mockaroo Data
	let promiseMockaroo = new Promise((resolve, reject) => {
		return resolve(retrieveMockarooData());
	});
	let mockarooArray = await promiseMockaroo;
	console.log(mockarooArray.length);

	return [bfhArray, mockarooArray];
}

function retrieveBFHData() {
	return rp(config_bfh)
		.then(function (body) {
			let birthDate = new Date(body.birthDate);
			if (birthDate.getFullYear() > 2000) {
				return JSON.stringify({});
			}
			return body;
		})
		.catch(function (err) {
			return console.log(err);
		});
}

function retrieveMockarooData() {
	return rp(config_mockaroo)
		.then(function (body) {
			return body;
		})
		.catch(function (err) {
			return console.log(err);
		});
}

function generateFileName(directory) {
	let extension = 'sqlite3';

	let timestamp = new Date().toISOString().substring(0, 10);
	timestamp += '-';
	timestamp += Date.now();

	console.log(timestamp);
	let filename = 'patdata-' + timestamp + '.' + extension;

	return path.join(__dirname, directory, filename);
}

function writeToDatabase(bfhData, mockarooData) {
	db.serialize(function () {
		db.run("CREATE TABLE Patient (ID INTEGER PRIMARY KEY, PID, SSN, FirstName, LastName, Gender, BirthDate, TreatmentType, InsuranceType, AddrStreet, AddrZip, AddrCity, DateOfEntry, DateOfDeparture)");
		for (let i = 0; i < requested_length; i++) {
			let bfhItem = bfhData[i];
			let mockarooItem = mockarooData[i]

			let randomEntryDate = randomDate(getTodayDate().minus({
				months: 2
			}), getTodayDate(), {
				treatmentType: mockarooItem.treatment_type,
				dateType: 'entry'
			});
			let randomDateOfDeparture = isValidDateString(mockarooItem.date_of_departure) ?
				randomDate(
					getTodayDate(),
					getTodayDate().plus({
						months: 1
					}), {
						treatmentType: mockarooItem.treatment_type,
						dateType: 'departure'
					}
				) : null;

			let query = 'INSERT INTO Patient VALUES (NULL, ' +
				createQueryString(mockarooItem.pid) +
				createQueryString(mockarooItem.social_security_number) +
				createQueryString(bfhItem.name[0].given[0]) +
				createQueryString(bfhItem.name[0].family) +
				createQueryString(bfhItem.gender) +
				createQueryString(new Date(bfhItem.birthDate).toISOString()) +
				createQueryString(mockarooItem.treatment_type) +
				createQueryString(mockarooItem.insurance_type) +
				createQueryString(bfhItem.address[0].line[0]) +
				createQueryString(bfhItem.address[0].postalCode) +
				createQueryString(bfhItem.address[0].city) +
				createQueryString(randomEntryDate) +
				createQueryString(randomDateOfDeparture, ');');
			db.run(query);
		}
	});
	db.close();
}

function createQueryString(line, param) {
	// optimize and watch out for the gap and param check
	let queryPartition;

	switch (typeof line) {
		case 'string':
			queryPartition = '"' + line + '"';
			break;
		case 'number':
			queryPartition = line;
			break;
		default:
			try {
				queryPartition = '"' + line.toISO() + '"';
			} catch {
				queryPartition = null;
			}
			console.log(queryPartition);
			break;
	}
	if (param) {
		return queryPartition + param;
	}
	return queryPartition + ', ';
}

function randomDate(start, end, itemOpts) {
	if (itemOpts.treatmentType === 'ambulant') {
		if (itemOpts.dateType === 'entry') {
			start = getTodayDate().set({
				hour: 0,

			});
			start = roundDateDown(start);
			end = getTodayDate();
		} else if (itemOpts.dateType === 'departure') {
			start = getTodayDate();
			end = getTodayDate().set({
				hour: 19
			});
			end = roundDateUp(end);
		}
	} else if (itemOpts.treatmentType === 'stationary') {
		if (itemOpts.dateType === 'departure') {
			start = start.set({
				hour: 6
			});

			end = end.set({
				hour: 10
			});

			start = roundDateDown(start);
			end = roundDateUp(end);
		}
	}
	let randomJSDate = new Date(getTime(start.toUTC()) + Math.random() * (getTime(end.toUTC()) - getTime(start.toUTC())));
	if (itemOpts.dateType === 'departure') {
		if (itemOpts.treatmentType === 'stationary') {
			return roundDateDown(luxon.DateTime.fromJSDate(randomJSDate).set({
				hour: randomNumberBetween(6, 10)
			}));
		} else {
			return roundDateDown(luxon.DateTime.fromJSDate(randomJSDate));
		}
	}
	return luxon.DateTime.fromJSDate(randomJSDate);
}

function getTodayDate() {
	return luxon.DateTime.local();
}

function getTime(luxonDateObject) {
	return luxonDateObject.toJSDate().getTime();
}

function isValidDateString(string) {
	return luxon.DateTime.fromISO(string).get('isValid');
}

function roundDateUp(date) {
	return date.set({
		minute: 59,
		second: 59,
		millisecond: 0
	});
}

function roundDateDown(date) {
	return date.set({
		minute: 0,
		second: 0,
		millisecond: 0
	});
}

function randomNumberBetween(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
