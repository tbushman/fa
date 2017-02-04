var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    passportLocalMongoose = require('passport-local-mongoose');

var Publisher = new Schema({
	userindex: Number,
	username: {
		type: String,
		unique: true,
		trim: true
	},
	password: String,
	givenName: String,
	email: String,
	begin: Date,
	end: Date,
	links: [],
	tl: [{
		year: Number,
		months: [] 
	}],
	avatar: String,
	doc: String
	
}, { collection: 'publishers' });

Publisher.plugin(passportLocalMongoose);

module.exports = mongoose.model('Publisher', Publisher);