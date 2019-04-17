const request = require('request');
const rp = require('request-promise');

const path = require('path');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(generateFileName('database'));

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

run();

async function run() {
	let bfhArray = [];

	while (bfhArray.length < 100) {
		let promiseBFH = new Promise((resolve, reject) => {
			return resolve(retrieveBFHData());
		});

		let resolved = await promiseBFH;
		if (!isEmpty(resolved)) {
			bfhArray.push(resolved);
		}
	}
	console.log(bfhArray.length);

	/*
	let promiseMockaroo = new Promise((resolve, reject) => {
		return retrieveMockarooData();
	});
	let leresult = await promiseMockaroo;
	*/

	//writeToDatabase(await promiseBFH, await promiseMockaroo);
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
	const GAP = ', ';
	console.log(bfhData.name[0].family)
	let last_name = bfhData.name[0].family;
	let first_name = bfhData.name[0].given.join(' ');
	let gender = bfhData.gender;
	let birthDate = new Date(bfhData.birthDate).toISOString();

	let street = bfhData.address[0].line[0];
	let city = bfhData.address[0].city;
	let postalCode = bfhData.address[0].postalCode;

	let treatment_type = mockarooData.treatment_type;
	let insurance_type = mockarooData.insurance_type;
	let pid = mockarooData.pid;
	let social_security_number = mockarooData.social_security_number;
	let date_of_entry = mockarooData.date_of_entry;
	let date_of_departure = mockarooData.date_of_departure;

	db.serialize(function () {
		db.run("CREATE TABLE Patient (PID, SSN, FirstName, LastName, Gender, BirthDate, TreatmentType, InsuranceType, AddrStreet, AddrZip, AddrCity, DateOfEntry, DateOfDeparture)");

		db.run('INSERT INTO Patient VALUES (' +
			pid + GAP +
			social_security_number + GAP +
			first_name + GAP +
			last_name + GAP +
			gender + GAP +
			birthDate + GAP +
			treatment_type + GAP +
			insurance_type + GAP +
			street + GAP +
			postalCode + GAP +
			city + GAP +
			date_of_entry + GAP +
			date_of_departure
		);

	});

	db.close();
}

function isEmpty(obj) {
	for (var prop in obj) {
		if (obj.hasOwnProperty(prop))
			return false;
	}
	return JSON.stringify(obj) === JSON.stringify({});
}
