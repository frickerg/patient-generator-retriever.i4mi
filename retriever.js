const request = require('request');
const rp = require('request-promise');

const path = require('path');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(generateFileName('database'));

const requested_lenght = 100;
const GAP = ', ';
const QUOTE = '\'';
const BREAK = ');';

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
	if (result[0].length === requested_lenght && result[1].length === requested_lenght) {
		writeToDatabase(result[0], result[1]);
	}
});

async function run() {
	// Retrieve BFH Data
	let bfhArray = [];
	while (bfhArray.length < requested_lenght) {
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
		db.run("CREATE TABLE Patient (PID, SSN, FirstName, LastName, Gender, BirthDate, TreatmentType, InsuranceType, AddrStreet, AddrZip, AddrCity, DateOfEntry, DateOfDeparture)");
		for (let i = 0; i < requested_lenght; i++) {
			let bfhItem = bfhData[i];
			let mockarooItem = mockarooData[i]

			let query = 'INSERT INTO Patient VALUES (' +
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
				createQueryString(mockarooItem.date_of_entry) +
				createQueryString(mockarooItem.date_of_departure, BREAK);
			console.log(query);
			console.log();
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
			queryPartition = QUOTE + line + QUOTE;
			break;
		case 'number':
			queryPartition = line;
		default:
			queryPartition = null;
			break;
	}
	if (param) {
		return queryPartition + param;
	}
	return queryPartition + GAP;
}
