var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
	Content = require('./content.js');

var Geotime = new Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},
	geoindex: Number,
	publishers: [{
		_id: String,
		username: String,
		userindex: Number,
		begin: Date
	}],
	content: [ Content ],
	tl: [{
		year: Number,
		months: [] 
	}]
}, { collection: 'fad' });
Geotime.set('autoIndex', false);

module.exports = mongoose.model('Geotime', Geotime);

