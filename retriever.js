const request = require('request');
const config = {
    json: true
};

request('http://patient-generator.i4mi.bfh.ch/patient/get', config, (err, res, body) => {
    if (err) {
        return console.log(err);
    }
    console.log(body);

    let birthDate = new Date(body.birthDate);
    if (birthDate.getFullYear() > 2000) {
        return;
    }
    console.log(body);

    knex.schema.createTable('users', function (table) {
        table.increments();
        table.string('name');
        table.timestamps();
    });

});