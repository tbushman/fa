var express = require('express');
var passport = require('passport');
var router = express.Router();
var url = require('url');
var fs = require('fs');
var path = require('path');
var moment = require("moment");
var async = require("async");
var multer = require('multer');
var mkdirp = require('mkdirp');
var spawn = require("child_process").spawn;
var dotenv = require('dotenv');
var Publisher = require('../models/publishers.js');
var Geotime = require('../models/geotimes.js');
var publishers = path.join(__dirname, '/../..');
var request = require('request');
var marked = require('marked');
var upload = multer();

/*marked.setOptions({
  highlight: function (code, lang, callback) {
    require('pygmentize-bundled')({ lang: lang, format: 'html' }, code, function (err, result) {
      callback(err, result.toString());
    });
  }
});*/
/*marked.setOptions({
  highlight: function (code) {
    return require('highlight.js').highlightAuto(code).value;
  }
});*/

//Todo: user remove triggers userindex $inc -1
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		var p = ''+publishers+'/pu/publishers/fad/'+ req.user.username +'/images/full/'+req.params.index+'';		
		var q = ''+publishers+'/pu/publishers/fad/'+ req.user.username +'/images/thumbs/'+req.params.index+'';
		
		fs.access(p, function(err) {
			if (err && err.code === 'ENOENT') {
				mkdirp(p, function(err){
					if (err) {
						console.log("err", err);
					}
					mkdirp(q, function(err){
						if (err) {
							console.log("err", err);
						}
    					cb(null, p)
					})
				})
			} else {
				cb(null, p)
			}
		})
  	},
	filename: function (req, file, cb) {
		if (req.params.type === 'pdf') {
			cb(null, file.fieldname + '_' + req.params.counter + '.pdf')
		} else {
			cb(null, file.fieldname + '_' + req.params.counter + '.jpeg')
		}    	
  	}
})
 
var uploadmedia = multer({ storage: storage })
dotenv.load();

var geolocation = require ('google-geolocation') ({
	key: process.env.GOOGLE_KEY
});

function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { 
		return next(); 
	}
	return res.redirect('/login');
}

//if logged in, go to your own profile
//if not, go to global profile (home)
router.get('/', function (req, res) {
	
	if (req.app.locals.loggedin) {
		req.app.locals.userId = req.user._id;
		req.app.locals.givenName = req.user.givenName;
		req.app.locals.loggedin = req.user.username;
		return res.redirect('/api/publish')
	} else {
		return res.redirect('/home')
	}
});

/*router.all('/emergencyservices', function(req, res, next){
	next()
})*/

router.get('/register', function(req, res) {
    return res.render('register', { } );
});


router.post('/register', upload.array(), function(req, res, next) {
	var imgurl;
	var imgbuf;
	if (req.body.svg) {
		imgbuf = new Buffer(req.body.svg, 'base64'); // decode
		imgurl = ''+publishers+'/pu/publishers/fad/'+ req.body.username +'/images/avatar/'+ req.body.username + '.svg'
	} else {
		imgbuf = new Buffer(req.body.avatar, 'base64'); // decode
		imgurl = ''+publishers+'/pu/publishers/fad/'+ req.body.username +'/images/avatar/'+ req.body.username + '.png'
	}
	var pdf = req.body.resume;
	var pdfbuf = new Buffer(req.body.resume, 'base64');
	var p = ''+publishers+'/pu/publishers/fad/'+ req.body.username + ''
	var pdfurl = ''+publishers+'/pu/publishers/fad/'+req.body.username+'/resume/'+ req.body.username + '.pdf'
	fs.access(p, function(err) {
		if (err && err.code === 'ENOENT') {
			mkdirp(p, function(err){
				if (err) {
					console.log("err", err);
				} else {
					var imgdir = ''+publishers+'/pu/publishers/fad/'+ req.body.username + '/images/avatar'
					mkdirp(imgdir, function(err){
						if (err) {
							console.log("err", err);
						} else {
							var pdfdir = ''+publishers+'/pu/publishers/fad/'+ req.body.username + '/resume'
							mkdirp(pdfdir, function(err){
								if (err) {
									console.log("err", err);
								} else {
									fs.writeFile(imgurl, imgbuf, function(err) {
										if(err) {
											console.log("err", err);
										}
										fs.writeFile(pdfurl, pdfbuf, function(error) {
											if(error) {
												console.log("error", error)
											}
											Publisher.find({}, function(err, list){
												if (err) {
													return next(err)
												}
												var userindex = list.length;
												var newimgurl = imgurl.replace('/var/www/pu', '').replace('/Users/traceybushman/Documents/pu.bli.sh/pu', '')
												var newpdfurl = '/pu/publishers/fad/'+req.body.username+'/resume/'+ req.body.username + '.pdf'
												Publisher.register(new Publisher({ username : req.body.username, givenName: req.body.givenName, email: req.body.email, userindex: userindex, avatar: newimgurl, doc: newpdfurl, begin: req.body.date, end: moment().utc().format() }), req.body.password, function(err, user) {
													if (err) {
														return res.render('register', {info: "Sorry. That username already exists. Try again."});
													}
													req.app.locals.givenName = req.body.givenName;
													req.app.locals.username = req.body.username;
													passport.authenticate('local')(req, res, function () {
														Publisher.findOne({username: req.body.username}, function(error, doc){
															if (error) {
																return next(error)
															}
															req.app.locals.userId = doc._id;
															req.app.locals.loggedin = doc.username;
															return res.redirect('/api/publish')
														})
													});
											  	});
											})
										})
								 	})
								}
							})
						}
					})
				}						
			});			
		} else {
			var pavatar = ''+publishers+'/pu/publishers/fad/'+ req.body.username + '/images/avatar'
			var presume =  ''+publishers+'/pu/publishers/fad/'+ req.body.username + '/resume'
			fs.access(pavatar, function(err) {
				if (err && err.code === 'ENOENT') {
					mkdirp(pavatar, function(err){
						if (err) {
							console.log("err", err);
						}
						fs.access(presume, function(err) {
							if (err && err.code === 'ENOENT') {
								mkdirp(presume, function(err){
									if (err) {
										console.log("err", err);
									}
								})
							} else {
								fs.writeFile(imgurl, imgbuf, function(err) {
									if(err) {
										console.log("err", err);
									}
									fs.writeFile(pdfurl, pdfbuf, function(error) {
										if(error) {
											console.log("error", error)
										}
										Publisher.find({}, function(err, list){
											if (err) {
												return next(err)
											}
											var userindex = list.length;
											var newimgurl = imgurl.replace('/var/www/pu', '').replace('/Users/traceybushman/Documents/pu.bli.sh/pu', '')
											var newpdfurl = '/pu/publishers/fad/'+req.body.username+'/resume/'+ req.body.username + '.pdf';
											Publisher.register(new Publisher({ username : req.body.username, givenName: req.body.givenName, email: req.body.email, userindex: userindex, avatar: newimgurl, doc: newpdfurl, begin: req.body.date, end: moment().utc().format() }), req.body.password, function(err, user) {
												if (err) {
													return res.render('register', {info: "Sorry. That username already exists. Try again."});
												}
												req.app.locals.givenName = req.body.givenName;
												req.app.locals.username = req.body.username;
												passport.authenticate('local')(req, res, function () {
													Publisher.findOne({username: req.body.username}, function(error, doc){
														if (error) {
															return next(error)
														}
														req.app.locals.userId = doc._id;
														req.app.locals.loggedin = doc.username;
														return res.redirect('/api/publish')
													})
												});
										  	});
										})
									})
								})
							}
						})
					})
				} else {
					fs.writeFile(imgurl, imgbuf, function(err) {
						if(err) {
							console.log("err", err);
						}
						fs.writeFile(pdfurl, pdfbuf, function(error) {
							if(error) {
								console.log("error", error)
							}
							Publisher.find({}, function(err, list){
								if (err) {
									return next(err)
								}
								var userindex = list.length;
								var newimgurl = imgurl.replace('/var/www/pu', '').replace('/Users/traceybushman/Documents/pu.bli.sh/pu', '')
								var newpdfurl = '/pu/publishers/fad/'+req.body.username+'/resume/'+ req.body.username + '.pdf'
								Publisher.register(new Publisher({ username : req.body.username, givenName: req.body.givenName, email: req.body.email, userindex: userindex, avatar: newimgurl, doc: newpdfurl, begin: req.body.date, end: moment().utc().format() }), req.body.password, function(err, user) {
									if (err) {
										return res.render('register', {info: "Sorry. That username already exists. Try again."});
									}
									req.app.locals.givenName = req.body.givenName;
									req.app.locals.username = req.body.username;
									passport.authenticate('local')(req, res, function () {
										Publisher.findOne({username: req.body.username}, function(error, doc){
											if (error) {
												return next(error)
											}
											req.app.locals.userId = doc._id;
											req.app.locals.loggedin = doc.username;
											return res.redirect('/api/publish')
										})
									});
							  	});
							})
						})
					})
				}
			})			
		}
	});
});

router.get('/login', function(req, res, next){
	return res.render('login', { 
		user: req.user
	});
});

router.post('/login', upload.array(), passport.authenticate('local'), function(req, res, next) {
	req.app.locals.userId = req.user._id;
	req.app.locals.loggedin = req.user.username;
	req.app.locals.username = req.user.username;
    res.redirect('/api/publish')
});

router.get('/logout', function(req, res) {
	
	req.app.locals.username = null;
	req.app.locals.userId = null;
	req.app.locals.zoom = null;
	req.app.locals.loggedin = null;
	req.logout();
	if (req.user || req.session) {
		req.user = null;
		req.session.destroy(function(err){
			if (err) {
				req.session = null;
				return next(err);
			} else {
				req.session = null;
				return res.redirect('/');
			}
		});		
	} else {
		return res.redirect('/');
	}
});

router.get('/home', function(req, res, next) {
	req.app.locals.username = null;
	var arp = spawn('arp', ['-a']);
	//console.log(arp.stdio[0].Pipe)
	var mac;
	arp.stdout.on('data', function(data){
		data += '';
		data = data.split('\n');
		mac = data[0].split(' ')[3];
	})
	// Configure API parameters 
	const params = {
		wifiAccessPoints: [{
			macAddress: ''+mac+'',
			signalStrength: -65,
			signalToNoiseRatio: 40
	    }]
	};
	
	var loc;
	var info;
	// Get data 
	async.waterfall([
		function(next){
			geolocation(params, function(err, data) {
				if (err) {
					console.log (err);
					loc = null;
					info = 'Could not find your location'
				} else {
					loc = JSON.parse(JSON.stringify({ lng: data.location.lng, lat: data.location.lat }))
					info = 'Publish something'
				}
				next(null, loc, info)
			});
		},
		function(loc, info, next){
			
			Geotime.find({}, function(err, data){
				if (err) {
					next(err)
				}
				var tl;
				if (!err && data.length === 0){
					return res.redirect('/register')
				}
				if (!err && !req.app.locals.tl) {
					var tlbegin = []
					var tlend = []
					for (var i in data) {
						tlbegin.push(data[i].tl[0].year)
						tlend.push(data[i].tl[data[i].tl.length-1].year)
					}
					tlbegin.sort()
					tlend.sort()
					var num_years = tlend[tlend.length-1] - tlbegin[0];
					var tl = []
					for (var i = 0; i <= num_years; i++) {
						tl.push({year: tlbegin[0]+i, months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]})
					}
					req.app.locals.tl = tl
					next(null, loc, info, tl, data)
				} else {
					tl = req.app.locals.tl
					next(null, loc, info, tl, data)
				}
				
			})
		}
	], function(err, loc, info, tl, data) {
		var zoom;
		var lat;
		var lng;
		if (req.app.locals.zoom) {
			zoom = req.app.locals.zoom
			lat = req.app.locals.lat
			lng = req.app.locals.lng
			info = 'Refreshed'
		} else {
			zoom = 3
			lat = loc.lat
			lng = loc.lng
		}
		var index;
		/*if (req.app.locals.index) {
			index = req.app.locals.index
		} else {*/
			index = 0
		//}
		var datarray = [];
		var userindarray = [];
		for (var l in data) {
			datarray.push(data[l])
			userindarray.push(data[l].userindex)
		}
		if (req.isAuthenticated()) {
			return res.render('publish', {
				userindex: userindarray[userindarray.length-1],
				loggedin: req.app.locals.loggedin,
				data: datarray,
				tl: tl,
				index: index,
				zoom: zoom,
				lng: lng,
				lat: lat,
				info: info
			})
		} else {
			return res.render('publish', {
				userindex: userindarray[userindarray.length-1],
				data: datarray,
				tl: tl,
				index: index,
				zoom: zoom,
				lng: lng,
				lat: lat,
				info: info
			})
		}		
	})
})

router.post('/zoom/:userindex/:zoom/:lat/:lng', function(req, res, next){
	var zoom = parseInt(req.params.zoom, 10);
	var lat = req.params.lat;
	var lng = req.params.lng;
	var userindex = parseInt(req.params.userindex, 10);
	Geotime.find({}, function(err, data){
		if (err) {
			next(err)
		}
		var index;
		if (req.app.locals.index) {
			index = req.app.locals.index
		} else {
			index = 0
		}
		var datarray = [];
		var userindarray = [];
		for (var l in data) {
			datarray.push(data[l])
			userindarray.push(data[l].userindex)
		}
		req.app.locals.zoom = zoom;
		req.app.locals.lat = lat;
		req.app.locals.lng = lng;
		/*return res.render('publish', {
			userindex: userindarray[userindarray.length-1],
			data: datarray,
			tl: tl,
			index: index,
			zoom: zoom,
			lng: lng,
			lat: lat,
			info: 'zoomed'
		})*/
		return res.send('home')
	})
})

router.get('/:username', function (req, res, next) {
	//check if pos1 is username
	//view user profile 
	Geotime.find({}, function(err, pu) {
		if (err) {
			return next(err)
		}
		Publisher.findOne({username: req.params.username}, function(error, doc){
			if (error) {
				return next(error)
			}
			//req.app.locals.userId = doc._id;
			if (!err && doc !== undefined) {
				var zoom;
				var lat;
				var lng;
				var info;
				var index;
				if (req.app.locals.zoom) {
					zoom = req.app.locals.zoom;
					lat = req.app.locals.lat;
					lng = req.app.locals.lng;
					info = 'Refreshed';
					var datarray = [];
					for (var l in pu) {
						datarray.push(pu[l])
					}
					if (req.app.locals.index) {
						index = req.app.locals.index;
					} else {
						index = 0;
					}
					if (req.isAuthenticated()) {
						return res.render('publish', {
							username: doc.username,
							userindex: doc.userindex,
							loggedin: req.app.locals.loggedin,
							index: index,
							zoom: zoom,
							doc: doc,
							data: datarray,
							tl: doc.tl,
							lng: lng,
							lat: lat,
							info: info
						})
					} else {
						return res.render('publish', {
							username: doc.username,
							userindex: doc.userindex,
							index: index,
							zoom: zoom,
							doc: doc,
							data: datarray,
							tl: doc.tl,
							lng: lng,
							lat: lat,
							info: info
						})
					}					
				} else {
					zoom = 3

					if (doc.content.length === 0) {
						return next('That user has not added any content yet.')
					} else {
						Publisher.findOne({username: req.params.username},/* {content: {$elemMatch: {'properties.current': true}}},*/ function(er, current){
							if (er) {
								return next(er)
							}
							console.log(current)
							index = current.content[0].index;
							lat = current.content[0].geometry.coordinates[1];
							lng = current.content[0].geometry.coordinates[0];
							info = 'Intro';
							var datarray = [];
							for (var l in pu) {
								datarray.push(pu[l])
							}
							if (req.isAuthenticated()) {
								return res.render('publish', {
									username: doc.username,
									userindex: doc.userindex,
									infowindow: 'intro',
									loggedin: req.app.locals.loggedin,
									index: index,
									zoom: zoom,
									doc: doc,
									data: datarray,
									tl: doc.tl,
									lng: lng,
									lat: lat,
									info: info
								})
							} else {
								return res.render('publish', {
									username: doc.username,
									userindex: doc.userindex,
									infowindow: 'intro',
									index: index,
									zoom: zoom,
									doc: doc,
									data: datarray,
									tl: doc.tl,
									lng: lng,
									lat: lat,
									info: info
								})
							}
							
						})
					}
				}
			} else {
				return res.redirect('/home')				
			}
		})		
	})		
})


router.all('/mydata/*', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	if (outputPath.split('/').length > 3) {
		var zoom = parseInt(outputPath.split('/')[3], 10)
		var lat = outputPath.split('/')[4]
		var lng = outputPath.split('/')[5]
		var userindex = parseInt(outputPath.split('/')[2], 10)
		req.app.locals.zoom = zoom
		req.app.locals.lat = lat
		req.app.locals.lng = lng
		Geotime.findOne({index: index}, function(err, doc){
			if (err) {
				return next(err)
			}
			return res.send(doc.username)
		})
		
	} else {
		var userindex = parseInt(outputPath.split('/')[2], 10)
		Geotime.findOne({index: index}, function(err, doc){
			if (err) {
				return next(err)
			}
			return res.json(doc)
		})
	}
});

router.all('/focus/:id/:index/:zoom/:lat/:lng', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	var id = req.params.id;
	var index = req.params.index;
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	Geotime.findOne({content: {$elemMatch: {_id: id, index: index}}}, function(err, doc){
		if (err) {
			return next(err)
		}
		Geotime.find({}, function(error, data) {
			if (error) {
				return next(error)
			}
			if (req.params.lat === null || req.params.lat === 'null') {
				lat = doc.content[index].geometry.coordinates[1]
				lng = doc.content[index].geometry.coordinates[0]
			}
			req.app.locals.zoom = zoom;
			req.app.locals.lat = lat;
			req.app.locals.lng = lng;
			req.app.locals.index = index;
			var datarray = [];
			for (var l in data) {
				datarray.push(data[l])
			}
			
			if (req.isAuthenticated()) { 
				//if (req.user._id === userid) {
					return res.render('publish', {
						index: index,
						loggedin: req.app.locals.loggedin,
						infowindow: 'doc',
						username: doc.username,
						userindex: doc.userindex,
						zoom: zoom,
						data: datarray,
						doc: doc,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
			/*	} else {
					return res.render('publish', {
						index: index,
						infowindow: 'doc',
						username: doc.username,
						userindex: doc.userindex,
						zoom: zoom,
						data: datarray,
						doc: doc,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
				}*/
				
			} else {
				return res.render('publish', {
					index: index,
					infowindow: 'doc',
					username: doc.username,
					userindex: doc.userindex,
					zoom: zoom,
					data: datarray,
					doc: doc,
					tl: doc.tl,
					lat: lat,
					lng: lng,
					info: ':)'
				})
			}			
		})						
	})
	
})

router.post('/list/:id/:index/:zoom/:lat/:lng', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	var id = req.params.id;
	var index = req.params.index;
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	req.app.locals.zoom = zoom;
	req.app.locals.lat = lat;
	req.app.locals.lng = lng;
	req.app.locals.index = index;
	Geotime.findOne({content: {$elemMatch: {_id: id, index: index}}}, function(err, doc){
		if (err) {
			return next(err)
		}
		return res.json(doc.content[index])				
	})
	
})

router.get('/doc/:id/:zoom/:lat/:lng', function(req, res, next){
	var id = req.params.id;
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	req.app.locals.zoom = zoom;
	req.app.locals.lat = lat;
	req.app.locals.lng = lng;
	Publisher.findOne({content: {$elemMatch: {_id: id}}}, function(err, doc){
		if (err) {
			return next(err)
		}
		Geotime.find({}, function(error, data) {
			if (error) {
				return next(error)
			}
			var datarray = [];
			for (var l in data) {
				datarray.push(data[l])
			}
			if (req.isAuthenticated()){
				return res.render('publish', {
					index: 0,
					infowindow: 'cv',
					loggedin: req.app.locals.loggedin,
					userindex: doc.userindex,
					username: doc.username,
					zoom: zoom,
					data: datarray,
					doc: doc,
					tl: doc.tl,
					lat: lat,
					lng: lng,
					info: ':)'
				})
				
			} else {
				return res.render('publish', {
					index: 0,
					infowindow: 'cv',
					userindex: doc.userindex,
					username: doc.username,
					zoom: zoom,
					data: datarray,
					doc: doc,
					tl: doc.tl,
					lat: lat,
					lng: lng,
					info: ':)'
				})
			}
		})
	})
})

router.all('/gallery/:id/:index/:imgindex/:zoom/:lat/:lng', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	var id = req.params.id;
	var imgindex = parseInt(req.params.imgindex, 10);
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	req.app.locals.zoom = zoom;
	req.app.locals.lat = lat;
	req.app.locals.lng = lng;
	req.app.locals.imgindex = imgindex;
	if (req.params.index.split('_')[0] === 'all') {
		var index = req.params.index.split('_')[1]
		
		Publisher.findOne({content: {$elemMatch: {_id: id}}}, function(err, doc){
			if (err) {
				return next(err)
			}
			var img;
			var type;
			if (!doc.content[index].properties.media[imgindex].image) {
				type = 'iframe'
				img = doc.content[index].properties.media[imgindex].iframe
			} else {
				type = 'image'
				img = doc.content[index].properties.media[imgindex].image
			}
			Geotime.find({}, function(error, data) {
				if (error) {
					return next(error)
				}
				var datarray = [];
				for (var l in data) {
					datarray.push(data[l])
				}
				if (req.isAuthenticated()) {
					return res.render('publish', {
						index: index,
						infowindow: 'gallery',
						loggedin: req.app.locals.loggedin,
						userindex: doc.userindex,
						username: doc.username,
						zoom: zoom,
						data: datarray,
						img: img,
						imgindex: imgindex,
						type: type,
						doc: doc,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
				} else {
					return res.render('publish', {
						index: index,
						infowindow: 'gallery',
						userindex: doc.userindex,
						username: doc.username,
						zoom: zoom,
						data: datarray,
						img: img,
						imgindex: imgindex,
						type: type,
						doc: doc,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
				}				
			})
		})
	} else {
		index = parseInt(req.params.index, 10);
		req.app.locals.index = index;
		var key = 'content.$'
		var query = {_id: id, content: {$elemMatch: {index: index}}}
		//var projection = {key: 1}

		Geotime.findOne({content: {$elemMatch: {_id: id, index: index}}}, function(err, doc){
			if (err) {
				return next(err)
			}
			var img;
			var type;
			if (!doc.content[index].properties.media[imgindex].image) {
				type = 'iframe'
				img = doc.content[index].properties.media[imgindex].iframe
			} else {
				type = 'image'
				img = doc.content[index].properties.media[imgindex].image
			}
			Geotime.find({}, function(error, data) {
				if (error) {
					return next(error)
				}
				var datarray = [];
				for (var l in data) {
					datarray.push(data[l])
				}
				if (req.isAuthenticated()) {
					return res.render('publish', {
						index: index,
						infowindow: 'doc',
						loggedin: req.app.locals.loggedin,
						userindex: doc.userindex,
						username: doc.username,
						zoom: zoom,
						data: datarray,
						img: img,
						imgindex: imgindex,
						type: type,
						doc: doc,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
				} else {
					return res.render('publish', {
						index: index,
						infowindow: 'doc',
						userindex: doc.userindex,
						username: doc.username,
						zoom: zoom,
						data: datarray,
						img: img,
						imgindex: imgindex,
						type: type,
						doc: doc,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
				}
			})
		})
	}	
})

router.all('/publisherfocus/:userid/:zoom/:lat/:lng', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	var userid = req.params.userid;
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	Publisher.findOne({_id: userid}, function(err, doc){
		if (err) {
			return next(err)
		}
		Geotime.find({}, function(error, data) {
			if (error) {
				return next(error)
			}
			if (req.params.lat === null || req.params.lat === 'null') {
				lat = doc.content[doc.content.length-1].geometry.coordinates[1]
				lng = doc.content[doc.content.length-1].geometry.coordinates[0]
			}
			req.app.locals.zoom = zoom;
			req.app.locals.lat = lat;
			req.app.locals.lng = lng;
			var datarray = [];
			for (var l in data) {
				datarray.push(data[l])
			}
			if (req.isAuthenticated()) {
				return res.render('publish', {
					index: 0,
					infowindow: 'publisher',
					loggedin: req.app.locals.loggedin,
					userindex: doc.userindex,
					zoom: zoom,
					data: datarray,
					doc: doc,
					tl: doc.tl,
					lat: lat,
					lng: lng,
					info: ':)'
				})			
				
			} else {
				return res.render('publish', {
					index: 0,
					infowindow: 'publisher',
					userindex: doc.userindex,
					zoom: zoom,
					data: datarray,
					doc: doc,
					tl: doc.tl,
					lat: lat,
					lng: lng,
					info: ':)'
				})			
				
			}
		})						
	})	
})


router.all('/search/:term', function(req, res, next){
	var term = req.params.term;
	var regex = new RegExp(term);
	console.log(regex)
	Geotime.find({username: { $regex: regex }}, function(err, pu){
		if (err) {
			return next(err)
		}
		if (!err && pu === null) {
			return ('none')
		}
		return res.json(pu)
	})
})


router.all('/api/*', ensureAuthenticated)

router.get('/api/publish', function(req, res, next){
	req.app.locals.username = req.user.username;
	var arp = spawn('arp', ['-a']);
	//console.log(arp.stdio[0].Pipe)
	var mac;
	arp.stdout.on('data', function(data){
		data += '';
		data = data.split('\n');
		mac = data[0].split(' ')[3];
	})
	// Configure API parameters 
	const params = {
		wifiAccessPoints: [{
			macAddress: ''+mac+'',
			signalStrength: -65,
			signalToNoiseRatio: 40
	    }]
	};
	var loc;
	var info;
	// Get data 
	async.waterfall([
		function(next){
			geolocation(params, function(err, data) {
				if (err) {
					console.log (err);
					loc = null;
					info = 'Could not find your location'
				} else {
					loc = JSON.parse(JSON.stringify({ lng: data.location.lng, lat: data.location.lat }))
					info = 'Publish something'
				}
				next(null, loc, info)
			});
		},
		function(loc, info, next){
			Geotime.find({username: req.app.locals.username}, function(err, pu){
				if (err) {
					next(err)
				}
				var tl = pu[0].tl
				var userindex = parseInt(pu[0].userindex, 10)
				if (!err && pu[0].content.length === 0) {
					req.app.locals.index = 0
					req.app.locals.userId = pu[0]._id
					var thisindex = pu.length
					var content = [];
					var dateend = moment().utc().format();
					var current = true;
					
					var entry = {
						_id: req.app.locals.userId,
						type: "Feature",
						index: i,
						properties: {
							_id: userindex,
							user: req.app.locals.userId,
							title: importjson[i].properties.title,
							label: importjson[i].properties.name,
							place: importjson[i].properties.place,
							description: importjson[i].properties.description,
							current: current,
							link: {
								url: importjson[i].properties.link,
								caption: importjson[i].properties.linktext
							},
							time: {
								begin: importjson[i].properties.datebegin,
								end: dateend
							},
							media: []
						},
						geometry: {
							type: importjson[i].geometry.type,
						    coordinates: [importjson[i].geometry.coordinates[0], importjson[i].geometry.coordinates[1]]
						}
					}
					if (req.app.locals.username === 'tbushman') {
						fs.access('./json/import_cdb.json', function(err) {
							if (err && err.code === 'ENOENT') {
								//console.log(err)
								next(err)
							} else {
								var importthis = require('../json/import_cdb.json');
								//var features = JSON.parse(JSON.stringify(importjson.features))
								//console.log(features)
								var importjson = JSON.parse(JSON.stringify(importthis.features));
								importjson.sort(function(a, b){
									return (a.properties.datebegin > b.properties.datebegin) ? -1 : ((a.properties.datebegin < b.properties.datebegin) ? 1 : 0);
								})

								
								for (var i in importjson) {
									var dateend;
									var current;
									if (importjson[i].properties.place === 'TBushman | Freelance Design and Data') {
										dateend = moment().utc().format()
										current = true;
									} else {
										dateend = importjson[i].properties.dateend;
										current = false;
									}
									var entry = {
										_id: req.app.locals.userId,
										type: "Feature",
										index: i,
										properties: {
											_id: userindex,
											user: req.app.locals.userId,
											title: importjson[i].properties.title,
											label: importjson[i].properties.name,
											place: importjson[i].properties.place,
											description: importjson[i].properties.description,
											current: current,
											link: {
												url: importjson[i].properties.link,
												caption: importjson[i].properties.linktext
											},
											time: {
												begin: importjson[i].properties.datebegin,
												end: dateend
											},
											media: []
										},
										geometry: {
											type: importjson[i].geometry.type,
										    coordinates: [importjson[i].geometry.coordinates[0], importjson[i].geometry.coordinates[1]]
										}
									}
									var c = 0;
									for (var j = 1; j < 6; j++) {
										var picno = 'pic'+j;
										var thumb = picno+'_thumb';
										var blurb = picno+'_blurb';
										var name = picno+'_name';
										var url = picno+'_url';
										if (importjson[i].properties[picno] !== null) {
											var image;
											var thumb;
											if (importjson[i].properties[picno].split('/')[0] !== 'http:') {
												image = '/publishers/'+req.app.locals.username+'/'+ importjson[i].properties[picno]
											} else {
												image = importjson[i].properties[picno].replace('http://pu.bli.sh', '/publishers/'+req.app.locals.username+'')
											}

											if (importjson[i].properties[thumb].split('/')[0] !== 'http:') {
												thumb = '/publishers/'+req.app.locals.username+'/'+ importjson[i].properties[thumb]
											} else {
												thumb = importjson[i].properties[thumb].replace('http://pu.bli.sh', '/publishers/'+req.app.locals.username+'')
											}
											var media1 = {
												index: c,
												name: importjson[i].properties[name],
												image: image,
												iframe: "",
												thumb: thumb,
												caption: importjson[i].properties[blurb],
												url: importjson[i].properties[url],
												links: []
											}

											entry.properties.media.push(media1)
											c++
										}
									}
									for (var k = 1; k < 4; k++) {
										var ifno = 'iframe'+k;
										var thumb = ifno+'_thumb';
										var blurb = ifno+'_blurb';
										var name = ifno+'_name';
										var url = ifno+'_url';
										if (importjson[i].properties[ifno] !== null) {
											var iframe;
											var thumb;
											if (importjson[i].properties[ifno].split('/')[0] !== 'http:') {
												iframe = '/publishers/'+req.app.locals.username+'/'+ importjson[i].properties[ifno]
											} else {
												iframe = importjson[i].properties[ifno].replace('http://pu.bli.sh', '/publishers/'+req.app.locals.username+'')
											}

											if (importjson[i].properties[thumb].split('/')[0] !== 'http:') {
												thumb = '/publishers/'+req.app.locals.username+'/'+ importjson[i].properties[thumb]
											} else {
												thumb = importjson[i].properties[thumb].replace('http://pu.bli.sh', '/publishers/'+req.app.locals.username+'')
											}
											var media2 = {
												index: c,
												name: importjson[i].properties[name],
												image: "",
												iframe: iframe,
												thumb: thumb,
												caption: importjson[i].properties[blurb],
												url: importjson[i].properties[url],
												links: []
											}

											entry.properties.media.push(media2)
											c++
										}

									}
									content.push(entry)
								}
								var options = { 
									//'overwrite': true,
									'new': true,
									'safe': true,
									'upsert': false
									//'multi': false 
								}
								Publisher.findOneAndUpdate(
									{username: req.app.locals.username},
									{$set: {content: content}},
									options,
									function(error, doc){
										if (error) {
											next(error)
										} else {
											var data = pu;
											var loc = {
												lng: doc.content[0].geometry.coordinates[0],
												lat: doc.content[0].geometry.coordinates[1]
											}
											req.app.locals.userId = doc._id
											next(null, data, loc, info, tl, userindex)
										}
									}
								)
							}
						})
					} else {
						var content = [{
							_id: req.app.locals.userId,
							type: "Feature",
							index: 0,
							properties: {
								_id: userindex,
								user: req.app.locals.userId,
								title: 'Home',
								label: req.app.locals.username,
								place: 'Edit me',
								description: 'Edit me',
								current: false,
								link: {
									url: 'Edit me',
									caption: 'Edit me'
								},
								time: {
									begin: pu[0].begin,
									end: moment(pu[0].begin).add(1, 'years').utc().format()
								},
								media: []
							},
							geometry: {
								type: 'Point',
							    coordinates: [loc.lng, loc.lat]
							}
						}];
						content = JSON.parse(JSON.stringify(content))
						var options = { 
							//'overwrite': true,
							'new': true,
							'safe': true,
							'upsert': false
							//'multi': false 
						}
						Publisher.findOneAndUpdate(
							{_id: req.app.locals.userId},
							{$set: {content: content}},
							options,
							function(error, doc){
								if (error) {
									next(error)
								} else {
									var data = pu;
									var loc = {
										lng: doc.content[0].geometry.coordinates[0],
										lat: doc.content[0].geometry.coordinates[1]
									}
									req.app.locals.userId = doc._id
									next(null, data, loc, info, tl, userindex)
								}
							}
						)
					}
					
				} else {
					Geotime.find({}, function(err, data){
						if (err) {
							return next(err)
						}
						next(null, data, loc, info, tl, userindex)						
					})
				}				
			})
		},
		function(data, loc, info, tl, userindex, next){
			if (tl.length === 0) {
				
				var end = new Date(data[0].end);
				var end_year = end.getFullYear() + 1;
			
				var begin = new Date(data[0].begin)
				var begin_year = begin.getFullYear();
				var num_years = end_year - begin_year;
				var tl = []
				for (var i = 0; i <= num_years; i++) {
					tl.push({year: begin_year+i, months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]})
				}
				//content = JSON.stringify(content)
				var options = { 
					//'overwrite': true,
					'new': true,
					'safe': true,
					'upsert': false
					//'multi': false 
				}
				Publisher.findOneAndUpdate(
					{_id: req.app.locals.userId},
					{$set: {tl: tl}},
					options,
					function(error, doc){
						if (error) {
							next(error)
						} else {
							Geotime.find({}, function(error, data) {
								if (error) {
									next(error)
								} else {
									var loc = {
										lng: doc.content[0].geometry.coordinates[0],
										lat: doc.content[0].geometry.coordinates[1]
									}
									info = 'Successfully imported geojson.'
									next(null, data, loc, info, userindex)
								}
							})
						}
					}
				)
				
			} else {
				next(null, data, loc, info, userindex)
			}
			
		}
	], function(err, data, loc, info, userindex){
		if (err) {
			return next(err)
		}
		var zoom;
		var lat;
		var lng;
		if (req.app.locals.zoom) {
			zoom = req.app.locals.zoom
			lat = req.app.locals.lat
			lng = req.app.locals.lng
			info = 'Refreshed'
		} else {
			zoom = 3
			lat = loc.lat
			lng = loc.lng
		}
		var index;
		if (req.app.locals.index) {
			index = req.app.locals.index
		} else {
			index = 0
		}
		var datarray = [];
		for (var l in data) {
			datarray.push(data[l])
		}
		return res.render('publish', {
			loggedin: req.app.locals.loggedin,
			username: req.app.locals.username,
			userindex: userindex,
			index: index,
			zoom: zoom,
			data: datarray,
			tl: data[0].tl,
			lng: lng,
			lat: lat,
			info: info
		})
		
	})

})

router.all('/api/deletefeature/:index', function(req, res, next) {
	var index = parseInt(req.params.index, 10);
	Publisher.findOneAndUpdate(
		{_id: req.app.locals.userId}, 
		{$pull:{content:{index:index}}}, 
		{multi: false, new: true}, function(err, doc) {
			if (err) {
				return next(err)
			}
			Geotime.find({}, function(error, data){
				if (error) {
					return next(error)
				}
				var datarray = [];
				for (var l in data) {
					datarray.push(data[l])
				}
				return res.render('publish', {
					loggedin: req.app.locals.loggedin,
					username: req.app.locals.username,
					userindex: doc.userindex,
					index: 0,
					zoom: 6,
					data: datarray,
					tl: data[0].tl,
					lng: doc.content[0].geometry.coordinates[0],
					lat: doc.content[0].geometry.coordinates[1],
					info: 'Deleted'
				})
			})
		}
	)
})

router.get('/api/editcontent/:index', function(req, res, next){
	var index = parseInt(req.params.index, 10);
	Publisher.findOne({_id: req.app.locals.userId}, function(error, doc){
		if (error) {
			return next(error)
		}
		var loc = doc.content[index].geometry.coordinates;
		Geotime.find({}, function(er, data){
			if (er) {
				return next(er)
			}
			var datarray = [];
			for (var l in data) {
				datarray.push(data[l])
			}
			var loc = doc.content[index].geometry.coordinates;
			return res.render('publish', {
				infowindow: 'edit',
				loggedin: req.app.locals.loggedin,
				username: req.app.locals.username,
				userindex: doc.userindex,
				index: index,
				zoom: 6,
				doc: doc,
				data: datarray,
				tl: data[0].tl,
				lng: loc[0],
				lat: loc[1],
				info: 'Edit your entry.'
			})
		})
	})
})

router.post('/api/editcontent/:index', upload.array(), function(req, res, next){
	var index = parseInt(req.params.index, 10);
	var title = req.body.title;
	var label = req.body.label;
	var place = req.body.place;
	var description = req.body.description;
	var linkurl = req.body.linkurl;
	var linkcaption = req.body.linkcaption;
	var datebegin = req.body.datebegin;
	var dateend = req.body.dateend;
	var lat = req.body.lat;
	var lng = req.body.lng;
	var body = req.body;
	
	async.waterfall([
		function(next){
			Publisher.findOne({_id: req.app.locals.userId}, function(err, pub) {
				if (err) {
					return next(err)
				}
				var id = parseInt(pub.userindex, 10)
				var keys = Object.keys(body);
				keys.splice(keys.indexOf('title'), 1)
				keys.splice(keys.indexOf('label'), 1)
				keys.splice(keys.indexOf('place'), 1)
				keys.splice(keys.indexOf('description'), 1)
				keys.splice(keys.indexOf('linkurl'), 1)
				keys.splice(keys.indexOf('linkcaption'), 1)
				keys.splice(keys.indexOf('datebegin'), 1)
				keys.splice(keys.indexOf('dateend'), 1)
				keys.splice(keys.indexOf('lat'), 1)
				keys.splice(keys.indexOf('lng'), 1)

				var thumburls = [];
				var count = 0;
				var i = 0;
				for (var i in keys) {
					var thiskey = 'thumb'+count+''

					if (keys[i] == thiskey) {
						//console.log(body[thiskey])
						var thisbody = body[thiskey]
						if (thisbody !== '/images/publish_logo_sq.svg' && thisbody.split('').length > 100) {
							//fs.writefile
							var thumbbuf = new Buffer(body[thiskey], 'base64'); // decode
							var thumburl = ''+publishers+'/pu/publishers/fad/'+ req.app.locals.username +'/images/thumbs/'+index+'/thumb_'+count+'.jpeg'
							thumburls.push(thumburl.replace('/var/www/pu', '').replace('/Users/traceybushman/Documents/pu.bli.sh/pu', ''))
							count++;
							fs.writeFile(thumburl, thumbbuf, function(err) {
								if(err) {
									console.log("err", err);
								} 
							})

						} else {
							thumburls.push(body[thiskey])
							count++
						}						
					} else {
						count = count;
					}
				}
				next(null, id, index, thumburls, body, keys)
			})
		},
		function(id, index, thumburls, body, keys, next) {
			var imgs = [];
			var count = 0;
			for (var k = 0; k < keys.length; k++) {
				var thiskey = 'img'+count+''
				if (keys[k] === thiskey) {
					imgs.push(body[keys[k]])
					count++;
				}
			}
			next(null, id, index, thumburls, imgs, body)
		},
		function(id, index, thumburls, imgs, body, next) {
			var entry = {
				_id: req.app.locals.userId,
				type: "Feature",
				index: index,
				properties: {
					_id: id,
					user: req.app.locals.userId,
					title: body.title,
					label: body.label,
					place: body.place,
					description: body.description,
					link: {
						url: body.linkurl,
						caption: body.linkcaption
					},
					time: {
						begin: body.datebegin,
						end: body.dateend
					},
					media: []
				},
				geometry: {
					type: "Point",
				    coordinates: [body.lng, body.lat]
				}
			}
			var entrymedia = []
			var thumbs = thumburls;
			var count = 0;
			if (thumbs.length > 0) {
				for (var i = 0; i < thumbs.length; i++) {
					var media;
					if (thumbs[i].split('.')[1] === 'svg') {
						media = {
							index: count,
							name: body['img'+i+'_name'],
							image: "",
							iframe: imgs[i],
							thumb: thumbs[i],
							caption: body['img'+i+'_caption'],
							url: body['img'+i+'_url'],
							links: []
						}
					} else {
						media = {
							index: count,
							name: body['img'+i+'_name'],
							image: imgs[i],
							iframe: "",
							thumb: thumbs[i],
							caption: body['img'+i+'_caption'],
							url: body['img'+i+'_url'],
							links: []
						}					
					}

					entrymedia.push(media)
					count++
				}
			}
			entry = JSON.parse(JSON.stringify(entry))
			var key = 'content.$'
			var push = {$set: {}};
			push.$set[key] = entry;
			
			var key2 = 'content.$.properties.media';
			var set = {$set: {}};
			set.$set[key2] = entrymedia;
			Publisher.findOneAndUpdate({_id: req.app.locals.userId, content: {$elemMatch: {index: index}}}, push, {safe: true, new: true, upsert: false}, function(error, bleh){
				if (error) {
					return next(error)
				}
				Publisher.findOneAndUpdate({_id: req.app.locals.userId, content: {$elemMatch:{index: index}}}, set, {safe: true, new: true, upsert: false}, function(errr, doc){
					if (errr) {
						return next(errr)
					}
					var loc = doc.content[index].geometry.coordinates;
					Geotime.find({}, function(er, data){
						if (er) {
							return next(er)
						}
						next(null, doc, data, index, loc)
					})
				})
				
			});
		}
	], function(err, doc, data, index, loc){
		if (err) {
			return next(err)
		}
		var datarray = [];
		for (var l in data) {
			datarray.push(data[l])
		}
		return res.render('publish', {
			infowindow: 'doc',
			loggedin: req.app.locals.loggedin,
			username: doc.username,
			userindex: doc.userindex,
			index: index,
			zoom: 6,
			doc: doc,
			data: datarray,
			tl: doc.tl,
			lng: loc[0],
			lat: loc[1],
			info: ':)'
		})
	})
	
})

router.get('/api/addfeature/:id/:zoom/:lat/:lng', function(req, res, next) {
	/*var id = req.params.id;
	if (id !== req.app.locals.userId) {
		return res.redirect('/login')
	}
	req.app.locals.userId = id;*/
	
	Publisher.findOne({_id: req.app.locals.userId}, function(err, pu) {
		if (err) {
			return next(err)
		}
		var index = pu.content.length-1;
		Geotime.find({}, function(er, data){
			if (er) {
				return next(er)
			}
			var datarray = [];
			for (var l in data) {
				datarray.push(data[l])
			}
			return res.render('publish', {
				infowindow: 'new',
				loggedin: req.app.locals.loggedin,
				username: req.app.locals.username,
				userindex: pu.userindex,
				index: index,
				zoom: req.params.zoom,
				data: datarray,
				lng: req.params.lng,
				lat: req.params.lat,
				info: 'drag the feature to the desired location'
			})
		})
	})	
})


router.all('/api/uploadmedia/:index/:counter/:type', uploadmedia.single('img'), function(req, res, next){
	if (req.file.path.split('.').indexOf('pdf') !== -1) {
		console.log('pdf hea')
		var pdfname = req.file.path.split('/').pop();
		var blobname = pdfname.replace('.pdf','.js');
		var bloburl = req.file.path.replace(pdfname, blobname);
		var requestpath = req.file.path.replace('/var/www/pu', '').replace('/Users/traceybushman/Documents/pu.bli.sh/pu', '');
		var request = require('request').defaults({encoding: 'binary'});
		request.get('http://localhost:'+process.env.PORT+''+requestpath, function (error, rep, body) {
			if (error) {
				console.log(error)
			}
			var myPdf = '';
			if (!error && rep.statusCode === 200) {
				myPdf = 'data:' + rep.headers['content-type'] + ';base64,' + new Buffer(body).toString('base64');
			}
			fs.writeFile(bloburl, JSON.stringify(myPdf), 'utf8');
			return res.send(bloburl);
		});
		
	} else {
		return res.send(req.file.path)
	}
	
});

router.all('/api/layout/:size/:id/:index', function(req, res, next){
	var index = parseInt(req.params.index, 10);
	var size = req.body.size;
	var id = req.body.id;
	var key2 = 'content.$.properties.layout';
	var set = {$set: {}};
	set.$set[key2] = size;
	Publisher.findOneAndUpdate({_id: id, content: {$elemMatch:{index: index}}}, set, {safe: true, new: true, upsert: false}, function(errr, doc){
		if (errr) {
			return next(errr)
		}
		var loc = doc.content[index].geometry.coordinates;
		Geotime.find({}, function(er, data){
			if (er) {
				return next(er)
			}
			var datarray = [];
			for (var l in data) {
				datarray.push(data[l])
			}
			return res.render('publish', {
				infowindow: 'layout',
				size: size,
				loggedin: req.app.locals.loggedin,
				username: req.app.locals.username,
				userindex: doc.userindex,
				index: index,
				zoom: 6,
				doc: doc,
				data: datarray,
				tl: doc.tl,
				lng: loc[0],
				lat: loc[1],
				info: 'Edit your entry. Add a name, image captions, and image URLs.'
			})
		})
	})	
})
router.post('/api/addcontent/:index', upload.array(), function(req, res, next){
	var index = parseInt(req.params.index, 10);
	var title = req.body.title;
	var label = req.body.label;
	var place = req.body.place;
	var description = req.body.description;
	var linkurl = req.body.linkurl;
	var linkcaption = req.body.linkcaption;
	var datebegin = req.body.datebegin;
	var dateend = req.body.dateend;
	var lat = req.body.lat;
	var lng = req.body.lng;
	var body = req.body;
	
	async.waterfall([
		function(next){
			Publisher.findOne({_id: req.app.locals.userId}, function(err, pub) {
				if (err) {
					return next(err)
				}
				var id = parseInt(pub.userindex, 10)
				var keys = Object.keys(body);
				keys.splice(keys.indexOf('title'), 1)
				keys.splice(keys.indexOf('label'), 1)
				keys.splice(keys.indexOf('place'), 1)
				keys.splice(keys.indexOf('description'), 1)
				keys.splice(keys.indexOf('linkurl'), 1)
				keys.splice(keys.indexOf('linkcaption'), 1)
				keys.splice(keys.indexOf('datebegin'), 1)
				keys.splice(keys.indexOf('dateend'), 1)
				keys.splice(keys.indexOf('lat'), 1)
				keys.splice(keys.indexOf('lng'), 1)
				//var imglength = body.length / 2;

				var thumburls = [];
				var count = 0;
				for (var i = 0; i < keys.length; i++) {
					var thiskey = 'thumb'+count+''

					if (keys[i] == thiskey) {
						//console.log(body[thiskey])
						var thisbody = body[thiskey]
						if (thisbody !== '/images/publish_logo_sq.svg' && thisbody.split('').length > 100) {
							//fs.writefile
							var thumbbuf = new Buffer(body[thiskey], 'base64'); // decode
							var thumburl = ''+publishers+'/pu/publishers/fad/'+ req.app.locals.username +'/images/thumbs/'+index+'/thumb_'+count+'.jpeg'
							thumburls.push(thumburl.replace('/var/www/pu', '').replace('/Users/traceybushman/Documents/pu.bli.sh/pu', ''))
							count++;
							fs.writeFile(thumburl, thumbbuf, function(err) {
								if(err) {
									console.log("err", err);
								} 
							})

						} else {
							thumburls.push(body[thiskey])
							count++
						}						
					}
				}
				var imgs = [];
				count = 0;
				for (var k = 0; k < keys.length; k++) {
					var thiskey = 'img'+count+''
					if (keys[k] === thiskey) {
						imgs.push(body[keys[k]])
						count++;
					}
				}
				next(null, id, index, thumburls, imgs, body)
			})
		},
		function(id, index, thumburls, imgs, body, next) {
			var entry = {
				_id: req.app.locals.userId,
				type: "Feature",
				index: index,
				properties: {
					_id: id,
					user: req.app.locals.userId,
					title: body.title,
					label: body.label,
					place: body.place,
					description: body.description,
					link: {
						url: body.linkurl,
						caption: body.linkcaption
					},
					time: {
						begin: body.datebegin,
						end: body.dateend
					},
					media: []
				},
				geometry: {
					type: "Point",
				    coordinates: [body.lng, body.lat]
				}
			}
			var entrymedia = []
			var thumbs = thumburls;
			var count = 0;
			if (thumbs.length > 0) {
				for (var i = 0; i < thumbs.length; i++) {
					var media;
					if (thumbs[i].split('.')[1] === 'svg') {
						media = {
							index: count,
							name: body['img'+i+'_name'],
							image: "",
							iframe: imgs[i],
							thumb: thumbs[i],
							caption: body['img'+i+'_caption'],
							url: body['img'+i+'_url'],
							links: []
						}
					} else {
						media = {
							index: count,
							name: body['img'+i+'_name'],
							image: imgs[i],
							iframe: "",
							thumb: thumbs[i],
							caption: body['img'+i+'_caption'],
							url: body['img'+i+'_url'],
							links: []
						}					
					}

					entrymedia.push(media)
					count++
				}
			}
			entry = JSON.parse(JSON.stringify(entry))
			var key = 'content'
			var push = {$push: {}};
			push.$push[key] = entry;
			
			var key2 = 'content.$.properties.media';
			var set = {$set: {}};
			set.$set[key2] = entrymedia;
			Publisher.findOneAndUpdate({_id: req.app.locals.userId}, push, {safe: true, new: true, upsert: false}, function(error, bleh){
				if (error) {
					return next(error)
				}
				Publisher.findOneAndUpdate({_id: req.app.locals.userId, content: {$elemMatch:{index: index}}}, set, {safe: true, new: true, upsert: false}, function(errr, doc){
					if (errr) {
						return next(errr)
					}
					var loc = doc.content[index].geometry.coordinates;
					Geotime.find({}, function(er, data){
						if (er) {
							return next(er)
						}
						next(null, doc, data, index, loc)
					})
				})
				
			});
		}
	], function(err, doc, data, index, loc){
		if (err) {
			return next(err)
		}
		var datarray = [];
		for (var l in data) {
			datarray.push(data[l])
		}
		return res.render('publish', {
			infowindow: 'edit',
			loggedin: req.app.locals.loggedin,
			username: req.app.locals.username,
			userindex: doc.userindex,
			index: index,
			zoom: 6,
			doc: doc,
			data: datarray,
			tl: data[0].tl,
			lng: loc[0],
			lat: loc[1],
			info: 'Edit your entry. Add a name, image captions, and image URLs.'
		})
	})
})

router.post('/api/highlight/:id/:index/:snip/:whole', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	console.log(outputPath)
	var query = {_id: req.params.id, content: {$elemMatch: {index: index}}}
	var set = {$set: {}};
	var key = 'content.$.description'
	set.$set[key] = req.params.whole;
	Content.findOneAndUpdate(query, set, {safe: true, new: true, upsert: false}, function(err, doc){
		if (err) {
			return next(err)
		}
		return marked(doc.content[index].description)
	})
})

module.exports = router;