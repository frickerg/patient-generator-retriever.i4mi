const request = require('request');
const config = {
	json: true
};
const uri = 'http://patient-generator.i4mi.bfh.ch/patient/get';

request(uri, config, (err, res, body) => {
	if (err) {
		return console.log(err);
	}

	let birthDate = new Date(body.birthDate);
	if (birthDate.getFullYear() > 2000) {
		return;
	}
	console.log(body);
});
