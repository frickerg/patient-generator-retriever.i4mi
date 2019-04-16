const request = require('request');
const path = require('path');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(generateFileName('database'));

const uri = 'http://patient-generator.i4mi.bfh.ch/patient/get';
const config = {
	json: true
};

request(uri, config, (err, res, body) => {
	db.serialize(function () {
		db.run("CREATE TABLE lorem (info TEXT)");

		var stmt = db.prepare("INSERT INTO lorem VALUES (?)");
		for (var i = 0; i < 10; i++) {
			stmt.run("Ipsum " + i);
		}
		stmt.finalize();

		db.each("SELECT rowid AS id, info FROM lorem", function (err, row) {
			console.log(row.id + ": " + row.info);
		});
	});

	db.close();

	if (err) {
		return console.log(err);
	}

	let birthDate = new Date(body.birthDate);
	if (birthDate.getFullYear() > 2000) {
		return;
	}
	console.log(body);
});

function generateFileName(directory) {
	let extension = 'sqlite3';

	let timestamp = new Date().toISOString().substring(0, 10);
	timestamp += '-';
	timestamp += Date.now();

	console.log(timestamp);
	let filename = 'patdata-' + timestamp + '.' + extension;

	return path.join(__dirname, directory, filename);
}
