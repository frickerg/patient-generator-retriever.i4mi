const request = require('request');
const path = require('path');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(generateFileName('database'));

const uri_bfh = 'http://patient-generator.i4mi.bfh.ch/patient/get';
const uri_mockaroo = 'https://my.api.mockaroo.com/lep_demonstrator_patient_mock.json?key=e7b8fb30';
const config = {
	json: true
};

run();

async function run() {
	let promiseBFH = new Promise((resolve, reject) => {
		return resolve(retrieveBFHData());
	});

	let promiseMockaroo = new Promise((resolve, reject) => {
		return resolve(retrieveMockarooData());
	});

	writeToDatabase(await promiseBFH, await promiseMockaroo);
}

function retrieveBFHData() {
	return request(uri_bfh, config, (err, res, body) => {
		if (err) {
			return console.log(err);
		}

		let birthDate = new Date(body.birthDate);
		if (birthDate.getFullYear() > 2000) {
			return JSON.stringify({});
		}
		return body;
	});
}

function retrieveMockarooData() {
	return request(uri_mockaroo, config, (err, res, body) => {
		return body;
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
	let last_name = bfhData.name.family;
	let first_name = bfhData.name.given.join(' ');
	let gender = bfhData.gender;
	let birthDate = bfhData.birthDate.toISOString();

	let street = bfhData.address.line[0];
	let city = bfhData.address.city;
	let state = bfhData.address.state;
	let postalCode = bfhData.address.postalCode;

	let treatment_type = mockarooData.treatment_type;
	let insurance_type = mockarooData.insurance_type;
	let pid = mockarooData.pid;
	let social_security_number = mockarooData.social_security_number;
	let date_of_entry = mockarooData.date_of_entry;
	let date_of_departure = mockarooData.date_of_departure;

	db.serialize(function () {
		db.run("CREATE TABLE Patient (UID, PID, SSN, FirstName, LastName, Gender, BirthDate, TreatmentType, InsuranceType, AddrStreet, AddrZip, AddrCity, DateOfEntry, DateOfDeparture)");

		db.run('INSERT INTO Patient VALUES (' +
			uid + GAP +
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
