var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
	Content = require('./content.js');

var Geotime = new Schema({
	index: Number,
	userid: String,
	content: [ Content ],
	tl: [{
		year: Number,
		months: [] 
	}]
}, { collection: 'fad' });

module.exports = mongoose.model('Geotime', Geotime);

