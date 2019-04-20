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
	// integrity check
	if (result[0].length === requested_length && result[1].length === requested_length) {
		writeToDatabase(result[0], result[1]);
	}
});

/*
 * Main function which retrieves Data from two API endpoints
 * @return collection of two arrays filled with retrieved API objects
 */
async function run() {
	// retrieve BFH data
	let bfhArray = [];
	while (bfhArray.length < requested_length) {
		let promiseBFH = new Promise((resolve, reject) => {
			return resolve(retrieveBFHData());
		});

		let resolved = await promiseBFH;
		if (resolved != JSON.stringify({})) {
			bfhArray.push(resolved);
		}
	}
	console.log(bfhArray.length);

	// retrieve mockaroo data
	let promiseMockaroo = new Promise((resolve, reject) => {
		return resolve(retrieveMockarooData());
	});
	let mockarooArray = await promiseMockaroo;
	console.log(mockarooArray.length);

	// return all retrieved data from both APIs
	return [bfhArray, mockarooArray];
}

/*
 * Retrieves Patient Data from the i4mi Patient Generator
 * @return response-promise object which should be awaited in an async function
 */
function retrieveBFHData() {
	return rp(config_bfh)
		.then(function (body) {
			let birthDate = new Date(body.birthDate);
			// integrity check with birthDate
			if (birthDate.getFullYear() > 2000) {
				// returns empty object if patient is too young
				return JSON.stringify({});
			}
			console.log(body)
			return body;
		})
		.catch(function (err) {
			return console.log(err);
		});
}

/*
 * Retrieves Patient Data from the Mockaroo API
 * @return response-promise object which should be awaited in an async function
 */
function retrieveMockarooData() {
	return rp(config_mockaroo)
		.then(function (body) {
			return body;
		})
		.catch(function (err) {
			return console.log(err);
		});
}

/*
 * Generates an unique filename in the correct path to persist the database file
 * @param directory, where the file should be saved
 * @return unique filename and full path for the database file
 */
function generateFileName(directory) {
	// generates the current date as ISO string and appends a timestamp
	let timestamp = new Date().toISOString().substring(0, 10);
	timestamp += '-';
	timestamp += Date.now();

	// generate file name
	console.log(timestamp);
	let extension = 'sqlite3';
	let filename = 'patdata-' + timestamp + '.' + extension;

	// return the full file path
	return path.join(__dirname, directory, filename);
}

/*
 * Merge the results from both APIs and write them to the database.
 * @param bfhData, array of items which have been retrieved from the i4mi API
 * @param mockarooData, array of items which have been retrieved from the mockaroo API
 */
function writeToDatabase(bfhData, mockarooData) {
	// open the database connection
	db.serialize(function () {
		// create the Patient table
		db.run("CREATE TABLE Patient (ID INTEGER PRIMARY KEY, PID, SSN, FirstName, LastName, Gender, BirthDate, TreatmentType, InsuranceType, AddrStreet, AddrZip, AddrCity, DateOfEntry, DateOfDeparture)");
		for (let i = 0; i < requested_length; i++) {
			// save the Items to interact with them later
			let bfhItem = bfhData[i];
			let mockarooItem = mockarooData[i]

			// creates a random date of entry which is in the defined range of two months ago until now
			// the configuration object is needed to trigger specific behavior in the randomDate method
			let randomDateOfEntry = randomDate(now().minus({
				months: 2
			}), now(), {
				treatmentType: mockarooItem.treatment_type,
				dateType: 'entry'
			});

			// creates a random date of departure which is in the defined range of today until one month later
			// if no date of departure is specified by the Mockaroo API, the variable will be set to null
			let randomDateOfDeparture = isValidDateString(mockarooItem.date_of_departure) ?
				randomDate(
					now(),
					now().plus({
						months: 1
					}), {
						treatmentType: mockarooItem.treatment_type,
						dateType: 'departure'
					}
				) : null;

			// generates the query with all the required data from both APIs
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
				createQueryString(randomDateOfEntry) +
				createQueryString(randomDateOfDeparture, ');');
			// execute the generated query string
			db.run(query);
		}
		console.log('insert query loop completed');
	});
	// close the connection to avoid memory bleed
	db.close();
	console.log('database connection closed');
}

/*
 * Generates a part of the overall insert query needed when writing to the database.
 * This query builder function also contains logic which overrides the parameters if needed.
 * Integrity checks are not performed here, but the behavior differs depending on the value type.
 *
 * @param line, containes the value which should be formatted for the insert query
 * @param endOfQuery, optional string which specifies the end of the query string
 *
 * @return correctly formatted string which can be injected into the overall query
 */
function createQueryString(line, endOfQuery) {
	try {
		// if the line param is a valid luxon.DateTime object, the param
		// will be formatted as a string in iso format
		line = line.toISO();
	} catch {}

	// creates the first part of the query string and adds quotes if necessary
	// if the line is not a sting, the query partition will be built without quotes
	let queryPartition = (typeof line === 'string') ?
		line = '"' + line + '"' :
		line;

	// appends the endOfQuery param if it exists
	// otherwise the overall query is assumed to be incomplete and a gap will be appended
	queryPartition += (endOfQuery) ? endOfQuery : ', ';

	return queryPartition;
}

/*
 * Generates a random luxon.DateTime between two specified dates.
 * Also takes behavior-modifying specifications into account.
 *
 * @param start, first possible DateTime in range
 * @param end, last possible DateTime in range
 * @param itemOpts, parameters which influence the behavior of the function
 *
 * @return random luxon.DateTime object according to the specified logic
 */
function randomDate(start, end, itemOpts) {
	if (itemOpts.treatmentType === 'ambulant') {
		// ambulant patients need to have their entry and departure on the same day
		// therefore a range only occuring today must be created
		if (itemOpts.dateType === 'entry') {
			// the options specify the data as a date of entry
			// the start of the possible range will be set to today at 00:00
			start = now().set({
				hour: 0,
			});
			start = roundDateDown(start);
			// the end of the possible range will be set to now
			end = now();
		} else if (itemOpts.dateType === 'departure') {
			// the options specify the data as a date of departure
			// the start of the possible range will be set to now
			start = now();
			// we assume that most ambulant patients tend to leave before 19:00 and apply this to our logic
			end = now().set({
				hour: 19
			});
			end = roundDateUp(end);
		}
	}

	// convert the start and end objects to time strings.
	// those will be set to UTC to avoid timezone-specific range offsets.
	let startTime = getTime(start);
	let endTime = getTime(end);

	// now that the applicable range is specified, it's time to generate the random date within the range.
	// the random date is saved as JavaScript Date object, as this is assumed to be safer for randomization
	let randomJSDate = new Date(startTime + Math.random() * (endTime - endTime));

	if (itemOpts.dateType === 'departure') {
		// random dates of departure should be rounded down
		if (itemOpts.treatmentType === 'stationary') {
			// usually patients leave before 10:00
			// therefore if the patient is stationary, the date of departure will be overwritten
			return roundDateDown(luxon.DateTime.fromJSDate(randomJSDate).set({
				hour: randomNumberBetween(6, 10)
			}));
		} else {
			return roundDateDown(luxon.DateTime.fromJSDate(randomJSDate));
		}
	}
	// if the object is a date of entry, no rounding is performed
	return luxon.DateTime.fromJSDate(randomJSDate);
}

/*
 * Creates a luxon.DateTime object of the current date and time.
 * @return local DateTime of the current moment
 */
function now() {
	return luxon.DateTime.local();
}

/*
 * Returns the time of a luxon.DateTime object by converting it to a JSDate to extract the time.
 * This method applies UTC to avoid timezone offsets.
 *
 * @param luxonDateObject, luxon.DateTime that should be extracted
 * @return exact time string from the UTC compliant JSDate object
 */
function getTime(luxonDateObject) {
	return luxonDateObject.toUTC().toJSDate().getTime();
}

/*
 * Checks if a provided date string is correct according to the iso format.
 *
 * @param dateString, assumed iso date that needs to be validated
 * @return whether or not the provided string is valid
 */
function isValidDateString(dateString) {
	return luxon.DateTime.fromISO(dateString).get('isValid');
}

/*
 * Rounds up any luxon.DateTime object to the end of its hour value.
 *
 * @param date, which needs to be rounded up
 * @return the rounded up date
 */
function roundDateUp(date) {
	return date.set({
		minute: 59,
		second: 59,
		millisecond: 0
	});
}

/*
 * Rounds down any luxon.DateTime object to the start of its hour value.
 *
 * @param date, which needs to be rounded down
 * @return the rounded down date
 */
function roundDateDown(date) {
	return date.set({
		minute: 0,
		second: 0,
		millisecond: 0
	});
}

/*
 * Generates a random number between two values.
 *
 * @param min, lowest acceptable number
 * @param max, highest acceptable number
 * @return random number within the specified range
 */
function randomNumberBetween(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
