var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Content = new Schema({
	type: String,
	index: Number,
	properties: {
		_id: Number,
		label: String,
		title: String,
		place: String,
		description: String,
		current: Boolean,
		layout: String,
		link: {
			url: String,
			caption: String
		},
		time: {
			begin: Date,
			end: Date
		},
		media: [
			{
				index: Number,
				name: String,
				image: String,
				iframe: String,
				thumb: String,
				caption: String,
				url: String,
				links: []
			}
		]		
	},
	geometry: {
		'type': {type: String},
	    coordinates: []
	}
})

Content.set('autoIndex', false);
module.exports = Content;