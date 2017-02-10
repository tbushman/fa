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
var publishers = path.join(__dirname, '/../../..');
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
dotenv.load();


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
		return res.redirect('/api/publish/'+req.user.username+'')
	} else {
		return res.redirect('/home')
	}
});

/*router.all('/emergencyservices', function(req, res, next){
	next()
})*/

function updatePublisher(publisher, next){
	Publisher.register(publisher, req.body.password, function(err, user) {
		if (err) {
			return res.redirect('/register');
		}
		req.app.locals.userId = user._id;
		req.app.locals.loggedin = user.username;
		passport.authenticate('local')(req, res, function () {
			Publisher.findOne({_id: user._id}, function(error, pu){
				if (error) {
					return next(error)
				}
				return next(null, pu)
			})
			
		});															
	})
}

function updateGeotime(geoindex, name, publisher, next) {
	var tl = []
	var end = new Date();
	var end_year = end.getFullYear() + 1;

	var begin = new Date(publisher.begin)
	var begin_year = begin.getFullYear();
	var num_years = end_year - begin_year;
	for (var i = 0; i <= num_years; i++) {

		tl.push({year: begin_year+i, months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]})
	}
	Geotime.find({}, function(er, data){
		if (er) {
			return next(er)
		}
		if (!er && data.length === 0) {
			publisher['userindex'] = 0;
			
			var geotime = new Geotime({
				name: name,
				geoindex: parseInt(geoindex, 10),
				publishers: [publisher],
				tl: tl
			})
			geotime.save(function(err, doc){
				if (err) {
					return next(err)
				}
				return next(null, doc)
			})
		} else {
			
			var datarray = [];
			for (var i in data) {
				datarray.push(data[i])
			}
			publisher['userindex'] = datarray[geoindex].publishers.length;
			if (geoindex < data.length) {

				var push = {$push:{}};
				push.$push['publishers'] = publisher;
				var set = {$set:{}};
				set.$set['tl'] = tl;
				Geotime.findOneAndUpdate(
					{geoindex: geoindex/*, publishers:{$elemMatch: {_id: user.id, username: req.body.username}}*/},
					push,
					{safe: true, new: true}, function(err, doc1){
						if (err) {
							return next(err)
						}
						Geotime.findOneAndUpdate(
							{geoindex: geoindex},
							set,
							{safe: true, new: true}, function(err, doc){
								if (err) {
									return next(err)
								}
								return next(null, doc)
							}
						)	
					}
				)
			} else {
				var geotime = new Geotime({
					name: name,
					geoindex: parseInt(geoindex, 10),
					publishers: [publisher],
					tl: tl
				})
				geotime.save(function(err, doc){
					if (err) {
						return next(err)
					}
					return next(null, doc)
				})
			}
		}
	})	
}

function ensureUser(req, res, next) {
	Publisher.findOne({username: ''+req.params.username+''}, function(err, user) {
	    if (err) {
	      return next(err);
	    } 
		if (user) {
	      return next();
	    } else {
			if (id === 'emergencyservices') {
				return res.redirect('http://es.bli.sh');
			}
	      return res.redirect('/')
	    }
	});
}

function ensureUserId(req, res, next) {
	Publisher.findOne({_id: req.params.userid}, function(err, user) {
	    if (err) {
	      return next(err);
	    } 
		if (user) {
	      return next();
	    } else {
			if (id === 'emergencyservices') {
				return res.redirect('http://es.bli.sh');
			}
	      return res.redirect('/')
	    }
	});
}

function ensureUserIndex(req, res, next) {
	Geotime.findOne({publishers:{userindex: parseInt(req.params.userindex, 10)}}, function(err, user) {
	    if (err) {
	      return next(err);
	    } 
		if (user._id === req.app.locals.userId) {
	      return next();
	    } else {
		
		/*	Publisher.find({}, function(er, data){
				if (er) {
					return next (err)
				}
				var datarray = [];
				for (var i in data) {
					datarray.push(data[i])
				}
				return res.render('publish', {
					loggedin: req.app.locals.loggedin,
					username: req.app.locals.username,
					userindex: user.userindex,
					index: parseInt(req.params.userindex, 10),
					zoom: (req.app.locals.zoom)?req.app.locals.zoom:6,
					data: datarray,
					tl: pu.tl,
					lng: user.content[index].geometry.coordinates[0],
					lat: user.content[index].geometry.coordinates[1],
					info: 'This is not your work. Continue?',
					cont: user.userindex
				})*/
				//wip. for now, publisher can only edit own work
				return res.redirect('/')
				//return next()
			//})
	      	
	    }
	});
}

router.get('/register', function(req, res) {	
    return res.render('register', { } );
});


router.post('/register', upload.array()/*, registerPublisher*/, function(req, res, next) {
	var link = {
		name: req.body.name,
		geoindex: parseInt(req.body.geoindex, 10)
	}
	var imgurl;
	var imgbuf;
	if (req.body.svg) {
		imgbuf = new Buffer(req.body.svg, 'base64'); // decode
		imgurl = ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+ req.body.username +'/images/avatar/'+ req.body.username + '.svg'
	} else {
		imgbuf = new Buffer(req.body.avatar, 'base64'); // decode
		imgurl = ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+ req.body.username +'/images/avatar/'+ req.body.username + '.png'
	}
	var pdf = req.body.resume;
	var pdfbuf = new Buffer(req.body.resume, 'base64');
	var p = ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+ req.body.username + ''
	var pdfurl = ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+req.body.username+'/resume/'+ req.body.username + '.pdf'
	fs.access(p, function(err) {
		if (err && err.code === 'ENOENT') {
			mkdirp(p, function(err){
				if (err) {
					console.log("err", err);
				} else {
					var imgdir = ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+ req.body.username + '/images/avatar'
					mkdirp(imgdir, function(err){
						if (err) {
							console.log("err", err);
						} else {
							var pdfdir = ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+ req.body.username + '/resume'
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
												var newpdfurl = '/pu/publishers/fad/'+req.body.name+'/'+req.body.username+'/resume/'+ req.body.username + '.pdf';
												
												var publisher = new Publisher({ username : req.body.username, givenName: req.body.givenName, email: req.body.email, userindex: userindex, avatar: newimgurl, doc: newpdfurl, begin: req.body.date, end: moment().utc().format(), links: [ link ] })
												updatePublisher(publisher, function(eror, pu){
													if (eror) {
														return next(eror)
													}
													req.app.locals.givenName = req.body.givenName;
													req.app.locals.username = req.body.username;
													updateGeotime(link.geoindex, link.name, publisher, function(er, doc){
														if (er) {
															return next(er)
														}
														req.app.locals.geoindex = doc.geoindex;
														return res.redirect('/api/publish/'+req.body.username+'')
													})
												})
										  	});											
										})
								 	})
								}
							})
						}
					})
				}						
			});			
		} else {
			var pavatar = ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+ req.body.username + '/images/avatar'
			var presume =  ''+publishers+'/pu/publishers/fad/'+req.body.name+'/'+ req.body.username + '/resume'
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
											var newpdfurl = '/pu/publishers/fad/'+req.body.name+'/'+req.body.username+'/resume/'+ req.body.username + '.pdf';
											
											var publisher = new Publisher({ username : req.body.username, givenName: req.body.givenName, email: req.body.email, userindex: userindex, avatar: newimgurl, doc: newpdfurl, begin: req.body.date, end: moment().utc().format(), links: [ link ] })
											updatePublisher(publisher, function(eror, pu){
												if (eror) {
													return next(eror)
												}
												req.app.locals.givenName = req.body.givenName;
												req.app.locals.username = req.body.username;
												updateGeotime(link.geoindex, link.name, publisher, function(er, doc){
													if (er) {
														return next(er)
													}
													req.app.locals.geoindex = doc.geoindex;
													return res.redirect('/api/publish/'+req.body.username+'')
												})
											})
									  	});
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
								var newpdfurl = '/pu/publishers/fad/'+req.body.name+'/'+req.body.username+'/resume/'+ req.body.username + '.pdf';
								Publisher.register(new Publisher({ username : req.body.username, givenName: req.body.givenName, email: req.body.email, userindex: userindex, avatar: newimgurl, doc: newpdfurl, begin: req.body.date, end: moment().utc().format(), links: [ link ] }), req.body.password, function(err, user) {
									if (err) {
										return res.render('register', {info: "Sorry. That username already exists. Try again."});
									}
									
									
									req.app.locals.givenName = req.body.givenName;
									req.app.locals.username = req.body.username;
									req.app.locals.userId = user._id;
									req.app.locals.loggedin = user.username;
									passport.authenticate('local')(req, res, function () {
										Publisher.findOne({_id: user._id}, function(error, pu){
											if (error) {
												return next(error)
											}
											var publisher = {
												_id: pu._id,
												username: pu.username,
												begin: req.body.date
											}
											updateGeotime(link.geoindex, link.name, publisher, function(er, doc){
												if (er) {
													return next(er)
												}
												req.app.locals.geoindex = doc.geoindex;
												return res.redirect('/api/publish/'+req.body.username+'')
											})
										})
										
									});															
								})
						  	});
						})
					})
				}
			})			
		}
	});
});

router.get('/login', function(req, res, next){
	return res.render('login', { });
});

router.post('/login', upload.array(), passport.authenticate('local'), function(req, res, next) {
	req.app.locals.userId = req.user._id;
	req.app.locals.loggedin = req.user.username;
	req.app.locals.username = req.user.username;
    res.redirect('/api/publish/'+req.user.username+'')
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
	//req.app.locals.username = null;
	var arp = spawn('arp', ['-a']);
	//console.log(arp.stdio[0].Pipe)
	
	//todo catch nazis...................................................................................
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
	//...................................................................................................
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
			//build global timeline
			//timeline is embedded in the first level of the Geotime model
			//each timeline / Geotime is a group project with content and publisher arrays queried by _id
			Geotime.find({}, function(err, data){
				if (err) {
					next(err)
				}
				var tl;
				if (!err && data.length === 0){
					return res.redirect('/register')
				}
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
				next(null, loc, info, tl, data)
				
			})
		}
	], function(err, loc, info, tl, data) {
		if (err) {
			return next(err)
		}
		var zoom;
		var lat;
		var lng;
		var index = 0;
		if (req.app.locals.zoom) {
			zoom = req.app.locals.zoom
			lat = req.app.locals.lat
			lng = req.app.locals.lng
			//index = req.app.locals.index
			info = 'Refreshed'
		} else {
			zoom = 3
			lat = loc.lat
			lng = loc.lng
			//index: 0
		}
		
		/*var datarray = [];
		for (var l in data) {
			datarray.push(data[l])
		}*/
		
		if (req.isAuthenticated()) {
			Geotime.find({publishers:{_id:req.user._id}}, function(er, pubs){
				if (er) {
					return next(err)
				}
				var current = []
				var geoindexes = []
				for (var i in pubs) {
					for (var j in pubs[i].content) {
						if (pubs[i].content[j].properties.current === true) {
							current.push(pubs[i].content[j].index)
							geoindexes.push(pubs[i].geoindex)
						}	
					}
				}
				var geoindex = geoindexes[geoindexes.length-1]
				index = current[current.length-1]
				if (!er && pubs === null) {
					return res.render('publish', {
						geoindex: geoindex,
						index: index,
						data: data,//rray,
						doc: data[data.length-1],
						tl: tl,
						index: index,
						zoom: zoom,
						lng: lng,
						lat: lat,
						info: info
					})
				}
				return res.render('publish', {
					geoindex: geoindex,
					index: index,
					loggedin: req.app.locals.loggedin,
					data: data,
					doc: pubs[geoindex],
					tl: tl,
					index: index,
					zoom: zoom,
					lng: lng,
					lat: lat,
					info: info
				})
			})
			
		} else {
			return res.render('publish', {
				geoindex: data[data.length - 1].geoindex,
				index: index,
				data: data,//rray,
				doc: data[data.length-1],
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

router.post('/zoom/:geoindex/:index/:zoom/:lat/:lng', function(req, res, next){
	var zoom = parseInt(req.params.zoom, 10);
	var lat = req.params.lat;
	var lng = req.params.lng;
	var geoindex = parseInt(req.params.geoindex, 10);
	var index = parseInt(req.params.index, 10);
	req.app.locals.zoom = zoom;
	req.app.locals.lat = lat;
	req.app.locals.lng = lng;
	req.app.locals.geoindex = geoindex;
	req.app.locals.index = index;
	return res.send('home')
})

/*router.param('username', function (req, res, next, id) {
 	var outputPath = url.parse(req.url).pathname;
	console.log(outputPath, id)
 	// try to get the user details from the User model and attach it to the request object
	//see express docs
	Publisher.findOne({username: ''+id+''}, function(err, user) {
	    if (err) {
	      next(err);
	    } else if (user) {
	      req.user = user;
	      next();
	    } else {
			if (id === 'emergencyservices') {
				return res.redirect('http://es.bli.sh');
			}
	      return res.redirect('/')
	    }
	});
});*/

router.get('/:username', ensureUser, function (req, res, next) {
	
	//view user profile 
	Geotime.find({}, function(err, data) {
		if (err) {
			return next(err)
		}
		//var contentarray = [];
		//about to try getting content from all where req publisher is collaborative
		/*for (var i in data) {
			for (var j in data[i].content) {
				contentarray.push(data[i].content[j].userindex)
			}
			
		}*/
		Geotime.find({'publishers.username': req.params.username}, function(error, pu){
			if (error) {
				return next(error)
			}
			if (!err && pu[0] === undefined) {
				return res.redirect('/home')
			} else {
				var contentarray = [];
				for (var i in pu) {
					for (var j in pu[i].content) {
						if (pu[i].content[j]._id === req.app.locals.userId) {
							contentarray.push(pu[i].content[j].userindex);
						}
					}
				}
				if (contentarray.length < 1) {
					return res.redirect('/home')
				} else {
					var geoindex;
					//geoindex is like the publisher condom
					//to house the content and the publisher
					var userindex;
					//to identify collaborator in api
					var index;
					//to identify content globally.
					//reference to collaborators array via userindex ...
					if (req.app.locals.geoindex) {
						geoindex = req.app.locals.geoindex;
						userindex = req.app.locals.userindex;
					} else {
						for (var i in pu) {
							for (var j in pu[i].publishers) {
								if (pu[i].publishers[j].userindex === contentarray[j]) {
									userindex = pu[i].publishers[j].userindex;
									index = pu[i].content[j].index;
									geoindex = pu[i].geoindex;
								}
							}
							
						}
						req.app.locals.index = index;
						req.app.locals.geoindex = geoindex;
					}
					Geotime.findOne({geoindex: geoindex, 'publishers.userid': pu._id}, function(errr, doc){
						if (errr) {
							return next(errr)
						}
						var zoom;
						var lat;
						var lng;
						var info;
						var index;
						if (req.app.locals.index) {
							index = req.app.locals.index;
						} else {
							index = 0;
						}
						var datarray = [];
						for (var l in data) {
							datarray.push(data[l])
						}
						if (req.app.locals.zoom) {
							zoom = req.app.locals.zoom;
							lat = req.app.locals.lat;
							lng = req.app.locals.lng;
							info = 'Refreshed';

							if (req.isAuthenticated()) {
								return res.render('publish', {
									geoindex: geoindex,
									username: pu.publishers[userindex].username,
									userindex: pu.publishers[userindex].userindex,
									loggedin: req.app.locals.loggedin,
									index: index,
									zoom: zoom,
									doc: doc,
									data: datarray,
									pu: pu.publishers[userindex],
									tl: data[geoindex].tl,
									lng: lng,
									lat: lat,
									info: info
								})
							} else {
								return res.render('publish', {
									geoindex: geoindex,
									username: pu.publishers[userindex].username,
									userindex: pu.publishers[userindex].userindex,
									index: index,
									zoom: zoom,
									doc: doc,
									data: datarray,
									pu: data[geoindex].publishers[userindex],
									tl: data[geoindex].tl,
									lng: lng,
									lat: lat,
									info: info
								})
							}					
						} else {
							zoom = 3

							if (data[geoindex].content.length === 0) {
								return next('That user has not added any content yet.')
							} else {
								lat = doc.content[index].geometry.coordinates[1];
								lng = doc.content[index].geometry.coordinates[0];
								info = 'Intro';
								var datarray = [];
								for (var l in data) {
									datarray.push(data[l])
								}
								if (req.isAuthenticated()) {
									return res.render('publish', {
										geoindex: geoindex,
										username: pu.publishers[userindex].username,
										userindex: pu.publishers[userindex].userindex,
										loggedin: req.app.locals.loggedin,
										index: index,
										zoom: zoom,
										doc: doc,
										data: datarray,
										pu: pu.publishers[userindex],
										tl: doc.tl,
										lng: lng,
										lat: lat,
										info: info										
									})
								} else {
									return res.render('publish', {
										geoindex: geoindex,
										username: pu.publishers[userindex].username,
										userindex: pu.publishers[userindex].userindex,
										index: index,
										zoom: zoom,
										doc: doc,
										data: datarray,
										pu: data[geoindex].publishers[userindex],
										tl: data[geoindex].tl,
										lng: lng,
										lat: lat,
										info: info
									})
								}
							}
						}
					})
				}
			}
		})
	})		
})

router.get('/alldata', function(req, res, next){
	Geotime.find({}, function(err, data){
		if (err) {
			return next(err)
		}
		console.log(data)
		return res.json(data)
	})
})

router.all('/mydata/*', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	if (outputPath.split('/').length > 3) {
		var zoom = parseInt(outputPath.split('/')[3], 10)
		var lat = outputPath.split('/')[4]
		var lng = outputPath.split('/')[5]
		var geoindex = parseInt(outputPath.split('/')[2], 10)
		req.app.locals.zoom = zoom
		req.app.locals.lat = lat
		req.app.locals.lng = lng
		Geotime.findOne({geoindex: geoindex}, function(err, doc){
			if (err) {
				return next(err)
			}
			//0 will be conducting variable by tendril
			return res.send(doc.publishers[0].username)
		})
		
	} else {
		var geoindex = parseInt(outputPath.split('/')[2], 10)
		Geotime.findOne({geoindex: geoindex}, function(err, doc){
			if (err) {
				return next(err)
			}
			return res.json(doc)
		})
	}
});

router.all('/focus/:geoindex/:id/:index/:zoom/:lat/:lng', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	var id = req.params.id;
	var geoindex = parseInt(req.params.geoindex, 10)
	var index = parseInt(req.params.index, 10);
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	Geotime.findOne({geoindex: geoindex, content: {$elemMatch: {_id: id, index: index}}}, function(err, doc){
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
				Publisher.findOne({_id: req.user._id}, function(er, pu){
					if (er) {
						return next(er)
					}
					return res.render('publish', {
						geoindex: geoindex,
						index: index,
						loggedin: req.app.locals.loggedin,
						infowindow: 'doc',
						username: pu.username,
						userindex: pu.userindex,
						zoom: zoom,
						data: datarray,
						doc: doc,
						pu: pu,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
				})
				
			} else {
				Publisher.findOne({_id: id}, function(er, pu){
					if (er) {
						return next(er)
					}
					return res.render('publish', {
						geoindex: geoindex,
						index: index,
						infowindow: 'doc',
						username: pu.username,
						userindex: data[geoindex].content[index].properties._id,
						zoom: zoom,
						data: datarray,
						doc: doc,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
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
	Geotime.findOne({content: {$elemMatch: {_id: id}}}, function(err, doc){
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
				Publisher.findOne({_id: req.user._id}, function(er, pu){
					if (er) {
						return next(er)
					}
					return res.render('publish', {
						geoindex: doc.geoindex,
						index: 0,
						infowindow: 'cv',
						loggedin: req.app.locals.loggedin,
						userindex: doc.userindex,
						username: doc.username,
						zoom: zoom,
						data: datarray,
						doc: doc,
						pu: pu, 
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
				})
				
			} else {
				return res.render('publish', {
					geoindex: doc.geoindex,
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

router.all('/gallery/:geoindex/:index/:imgindex/:zoom/:lat/:lng', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	var geoindex = parseInt(req.params.geoindex, 10);
	var imgindex = parseInt(req.params.imgindex, 10);
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	req.app.locals.zoom = zoom;
	req.app.locals.lat = lat;
	req.app.locals.lng = lng;
	req.app.locals.imgindex = imgindex;
	if (req.params.index.split('_')[0] === 'all') {
		var index = parseInt(req.params.index.split('_')[1], 10)
		
		Geotime.findOne({geoindex: geoindex}, function(err, doc){
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
					Publisher.findOne({_id: req.user._id}, function(er, pu){
						if (er) {
							return next(er)
						}
						return res.render('publish', {
							geoindex: geoindex,
							index: index,
							infowindow: 'gallery',
							loggedin: req.app.locals.loggedin,
							userindex: doc.userindex,
							username: doc.username,
							zoom: zoom,
							data: datarray,
							pu: pu,
							img: img,
							imgindex: imgindex,
							type: type,
							doc: doc,
							tl: doc.tl,
							lat: lat,
							lng: lng,
							info: ':)'
						})
					})
				} else {
					return res.render('publish', {
						geoindex: geoindex,
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
					Publisher.findOne({_id: req.user._id}, function(er, pu){
						if (er) {
							return next(er)
						}
						return res.render('publish', {
							geoindex: geoindex,
							index: index,
							infowindow: 'doc',
							loggedin: req.app.locals.loggedin,
							userindex: doc.userindex,
							username: doc.username,
							zoom: zoom,
							data: datarray,
							pu: pu,
							img: img,
							imgindex: imgindex,
							type: type,
							doc: doc,
							tl: doc.tl,
							lat: lat,
							lng: lng,
							info: ':)'
						})
					})
				} else {
					return res.render('publish', {
						geoindex: geoindex,
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

router.all('/pugallery/:id/:index/:imgindex/:zoom/:lat/:lng', function(req, res, next){
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
		
		Geotime.findOne({content: {$elemMatch: {_id: id}}}, function(err, doc){
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
					Publisher.findOne({_id: req.user._id}, function(er, pu){
						if (er) {
							return next(er)
						}
						return res.render('publish', {
							index: index,
							infowindow: 'gallery',
							loggedin: req.app.locals.loggedin,
							userindex: doc.userindex,
							username: doc.username,
							zoom: zoom,
							data: datarray,
							pu: pu,
							img: img,
							imgindex: imgindex,
							type: type,
							doc: doc,
							tl: doc.tl,
							lat: lat,
							lng: lng,
							info: ':)'
						})
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
					Publisher.findOne({_id: req.user._id}, function(er, pu){
						if (er) {
							return next(er)
						}
						return res.render('publish', {
							index: index,
							infowindow: 'doc',
							loggedin: req.app.locals.loggedin,
							userindex: doc.userindex,
							username: doc.username,
							zoom: zoom,
							data: datarray,
							pu: pu,
							img: img,
							imgindex: imgindex,
							type: type,
							doc: doc,
							tl: doc.tl,
							lat: lat,
							lng: lng,
							info: ':)'
						})
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
//todo focus on one collaborator's projects like this (doc is Geotime[geoindex]):
router.all('/geofocus/:geoindex/:userid/:zoom/:lat/:lng', function(req, res, next){
	var outputPath = url.parse(req.url).pathname;
	console.log(outputPath)
	var userid = req.params.userid;
	var zoom = req.params.zoom;
	var lat = req.params.lat;
	var lng = req.params.lng;
	var geoindex = parseInt(req.params.geoindex, 10)
	Geotime.findOne({geoindex: geoindex}, function(err, doc){
		if (err) {
			return next(err)
		}
		Geotime.find({}, function(error, data) {
			if (error) {
				return next(error)
			}
			//publisherfocus be more like
			//'publishers.userid': userid
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
				Publisher.findOne({_id: req.user._id}, function(er, pu){
					if (er) {
						return next(er)
					}
					return res.render('publish', {
						index: 0,
						infowindow: 'publisher',
						loggedin: req.app.locals.loggedin,
						userindex: pu.userindex,
						zoom: zoom,
						data: datarray,
						doc: doc,
						pu: pu,
						tl: doc.tl,
						lat: lat,
						lng: lng,
						info: ':)'
					})
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
	Geotime.find({name: { $regex: regex }}, function(err, data){
		if (err) {
			return next(err)
		}
		if (!err && data === null) {
			return ('none')
		}
		return res.json(data)
	})
})


router.all('/api/*', ensureAuthenticated)

router.get('/api/publish/:username', function(req, res, next){
	var username = req.params.username;
	console.log(username)
	req.app.locals.username = username;
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
	var location;
	var info;
	// Get data 
	async.waterfall([
		function(next){
			geolocation(params, function(err, data) {
				if (err) {
					console.log (err);
					location = null;
					info = 'Could not find your location'
				} else {
					location = JSON.parse(JSON.stringify({ lng: data.location.lng, lat: data.location.lat }))
					info = 'Publish something'
				}
				next(null, location, username, info)
			});
		},
		function(location, username, info, next){
			//su -
			Geotime.find({'publishers.username': username}, function(error, data){
				if (error) {
					next(error)
				}
				Publisher.findOne({username: username}, function(err, pu){
					if (err) {
						next(err)
					}
					req.app.locals.userId = pu._id
					var geoindex;
					var userindex;
					var tl;
					var datarray = [];
					for (var i in data) {
						if (data[i].content.length === 0){
							geoindex = data[i].geoindex;
							userindex = 0;
							req.app.locals.index = 0
							
							var thisindex = 0
							//var content = [];
							var dateend = moment().utc().format();
							var current = true;

							var entry = {
								_id: req.app.locals.userId,
								type: "Feature",
								index: thisindex,
								properties: {
									_id: pu.userindex,
									user: req.app.locals.userId,
									title: 'Home',
									label: 'fa',
									place: 'fa.bli.sh.d',
									description: 'fa.bli.sh.d',
									current: true,
									link: {
										url: 'https://github.com/tbushman/fa',
										caption: 'Edit me'
									},
									time: {
										begin: moment(pu.begin).utc().format(),
										end: moment(pu.begin).add(1, 'years').utc().format()
									},
									media: []
								},
								geometry: {
									type: 'Point',
								    coordinates: [location.lng, location.lat]
								}
							}

							var push = {$push:{}}
							push.$push['content'] = entry
							Geotime.findOneAndUpdate({geoindex: geoindex}, push, {safe: true, new: true}, function(err, doc){
								if (err) {
									next(err)
								}
								datarray.push(doc)
							})

						}
						datarray.push(data[i])
					}
					if (geoindex === undefined) {
						userindex = data[0].publishers[0].userindex;
						geoindex = 0;
					}
					next(null, info, username, userindex, geoindex)
				})
				
			})
			
		},
		function(info, username, userindex, geoindex, next){
			Geotime.findOne(
				{geoindex: geoindex, 'publishers.username': username},
				function(error, doc){
					if (error) {
						console.log(error)
					}
					Publisher.findOne({username: username}, function(err, pu){
						if (err) {
							return next(err)
						}
						Geotime.find({}, function(er, data){
							if (er) {
								return next(er)
							}

							next(null, data, doc, pu, info, userindex, geoindex)															
						})
					})
				}
			)
		}
	], function(err, data, doc, pu, info, userindex, geoindex){
		if (err) {
			return next(err)
		}
		var zoom;
		var lat;
		var lng;
		var index;
		if (req.app.locals.index) {
			index = req.app.locals.index
		} else {
			index = 0
		}
		if (req.app.locals.zoom) {
			zoom = req.app.locals.zoom
			lat = req.app.locals.lat
			lng = req.app.locals.lng
			info = 'Refreshed'
		} else {
			zoom = 3
			lat = doc.content[index].geometry.coordinates[1]
			lng = doc.content[index].geometry.coordinates[0]
		}
		var datarray = [];
		for (var l in data) {
			datarray.push(data[l])
		}
		return res.render('publish', {
			geoindex: geoindex,
			loggedin: req.app.locals.loggedin,
			username: req.app.locals.username,
			userindex: userindex,
			index: index,
			data: datarray,
			doc: doc,
			pu: pu,
			tl: doc.tl,
			zoom: zoom,
			lng: lng,
			lat: lat,
			info: info
		})	
	})
})

router.all('/api/deletefeature/:index', function(req, res, next) {
	var index = parseInt(req.params.index, 10);
	Geotime.findOneAndUpdate(
		{userid: req.app.locals.userId}, 
		{$pull:{content:{index:index}}}, 
		{multi: false, new: true}, function(err, doc) {
			if (err) {
				return next(err)
			}
			Geotime.update({userid: req.app.locals.userId, 'content.index':{$gte:index}}, {$inc:{'content.$.index': -1}}, function(er, data){
				if (er) {
					return next(error)
				}
				var datarray = [];
				for (var l in data) {
					datarray.push(data[l])
				}
				Publisher.findOne({_id: req.user._id}, function(er, pu){
					if (er) {
						return next(er)
					}
					return res.render('publish', {
						loggedin: req.app.locals.loggedin,
						username: req.app.locals.username,
						userindex: doc.userindex,
						index: 0,
						zoom: 6,
						data: datarray,
						pu: pu,
						tl: data[data.length-1].tl,
						lng: doc.content[index-1].geometry.coordinates[0],
						lat: doc.content[index-1].geometry.coordinates[1],
						info: 'Deleted'
					})
				})
			})
		}
	)
})

router.get('/api/editcontent/:geoindex/:index', function(req, res, next){
	var index = parseInt(req.params.index, 10);
	var geoindex = parseInt(req.params.geoindex, 10);
	Publisher.findOne({_id: req.app.locals.userId}, function(error, pu){
		if (error) {
			return next(error)
		}
		var userindex = pu.userindex;
		var userid = pu._id;
		Geotime.findOne({geoindex: geoindex, 'publishers.userid': userid, 'content.index': index}, function(err, doc){
			if (err) {
				return next(err)
			}
			Geotime.find({}, function(er, data){
				if (er) {
					return next(er)
				}
				var datarray = [];
				for (var l in data) {
					datarray.push(data[l])
				}
				var loc = data[userindex].content[index].geometry.coordinates;
				return res.render('publish', {
					infowindow: 'edit',
					loggedin: req.app.locals.loggedin,
					username: req.app.locals.username,
					userindex: doc.userindex,
					index: index,
					zoom: 6,
					doc: doc,
					data: datarray,
					pu: pu,
					tl: data[userindex].tl,
					lng: loc[0],
					lat: loc[1],
					info: 'Edit your entry.'
				})
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
			Geotime.findOne({userid: req.app.locals.userId}, function(err, doc) {
				if (err) {
					return next(err)
				}
				var id = parseInt(doc.userindex, 10)
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
			Geotime.findOneAndUpdate({userid: req.app.locals.userId, content: {$elemMatch: {index: index}}}, push, {safe: true, new: true, upsert: false}, function(error, bleh){
				if (error) {
					return next(error)
				}
				Geotime.findOneAndUpdate({userid: req.app.locals.userId, content: {$elemMatch:{index: index}}}, set, {safe: true, new: true, upsert: false}, function(errr, doc){
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
		Publisher.findOne({username: req.app.locals.loggedin}, function(er, pu){
			if (er) {
				return next(er)
			}
			return res.render('publish', {
				infowindow: 'doc',
				loggedin: req.app.locals.loggedin,
				username: pu.username,
				userindex: pu.userindex,
				index: index,
				zoom: 6,
				doc: doc,
				data: datarray,
				pu: pu,
				tl: doc.tl,
				lng: loc[0],
				lat: loc[1],
				info: ':)'
			})
		})
	})
})

router.get('/api/addfeature/:id/:zoom/:lat/:lng', function(req, res, next) {
	/*var id = req.params.id;
	if (id !== req.app.locals.userId) {
		return res.redirect('/login')
	}
	req.app.locals.userId = id;*/
	
	Geotime.findOne({userid: req.app.locals.userId}, function(err, doc) {
		if (err) {
			return next(err)
		}
		var index = doc.content.length-1;
		Geotime.find({}, function(er, data){
			if (er) {
				return next(er)
			}
			var datarray = [];
			for (var l in data) {
				datarray.push(data[l])
			}
			Publisher.findOne({_id: req.app.locals.userId}, function(er, pu){
				if (er) {
					return next(er)
				}
				return res.render('publish', {
					infowindow: 'new',
					loggedin: req.app.locals.loggedin,
					username: req.app.locals.username,
					userindex: doc.userindex,
					index: index,
					zoom: req.params.zoom,
					data: datarray,
					pu: pu,
					lng: req.params.lng,
					lat: req.params.lat,
					info: 'drag the feature to the desired location'
				})
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
/*
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
*/
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
			Geotime.findOne({userid: req.app.locals.userId}, function(err, doc) {
				if (err) {
					return next(err)
				}
				var id = parseInt(doc.userindex, 10)
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
			Geotime.findOneAndUpdate({userid: req.app.locals.userId}, push, {safe: true, new: true, upsert: false}, function(error, bleh){
				if (error) {
					return next(error)
				}
				Geotime.findOneAndUpdate({userid: req.app.locals.userId, content: {$elemMatch:{index: index}}}, set, {safe: true, new: true, upsert: false}, function(errr, doc){
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
		Publisher.findOne({_id: req.app.locals.userId}, function(er, pu){
			if (er) {
				return next(er)
			}
			return res.render('publish', {
				infowindow: 'edit',
				loggedin: req.app.locals.loggedin,
				username: pu.username,
				userindex: pu.userindex,
				index: index,
				zoom: 6,
				doc: doc,
				data: datarray,
				pu: pu,
				tl: data[userindex].tl,
				lng: loc[0],
				lat: loc[1],
				info: 'Edit your entry. Add a name, image captions, and image URLs.'
			})
		})
	})
})

/*router.post('/api/highlight/:id/:index/:snip/:whole', function(req, res, next){
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
})*/

module.exports = router;