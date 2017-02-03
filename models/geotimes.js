var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    passportLocalMongoose = require('passport-local-mongoose'),
	Content = require('./content.js');



var Geotime = new Schema({
	index: Number,
	content: [ Content ],
	tl: [{
		year: Number,
		months: [] 
	}]
}, { collection: 'fad' })

module.exports = mongoose.model('Geotime', Geotime);

