var express = require('express');
var marked = require('marked');
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);
var path = require('path');
var dotenv = require('dotenv');
var mongoose = require('mongoose');
var promise = require('bluebird');
//var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var routes = require('./routes/index');
var Publisher = require('./models/publishers');
var Geotime = require('./models/geotimes.js');
var async = require('async');
var fs = require('fs');
//var Content = require('./models/content');

dotenv.load();

passport.use(new LocalStrategy(Publisher.authenticate()));
mongoose.Promise = promise;

// serialize and deserialize
passport.serializeUser(function(user, done) {
  //console.log('serializeUser: ' + user._id);
  done(null, user._id);
});
passport.deserializeUser(function(id, done) {
	Publisher.findById(id, function(err, user){
    	//console.log(user);
    	if(!err) {
			app.use('/publishers', express.static(path.join(__dirname, '../../pu/publishers')));
			/*app.use('/publishers/fad/images', express.static(path.join(__dirname, '../../pu/publishers/fad/images')));
			app.use('/publishers/fad/images/full', express.static(path.join(__dirname, '../../pu/publishers/fad/images/full')));
			app.use('/publishers/fad/images/thumbs', express.static(path.join(__dirname, '../../pu/publishers/fad/images/thumbs')));
			*/
			done(null, user);
		} else { 
			done(err, null);
		}
    });
});
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

//app.use('/publishers', express.static(path.join(__dirname, '../../pu/publishers')));
app.locals.appTitle = 'fa.bli.sh';

//What's up 
/*

*/
app.use(express.static(path.join(__dirname, 'public')));
//app.use(favicon(path.join(__dirname, '/public/img', 'favicon.ico')));
app.locals.moment = require('moment');
app.locals.$ = require('jquery');
app.locals.fs = require('fs');
var marked = require('marked')
app.locals.md = marked; 
/*marked.setOptions({
  highlight: false
});*/
//app.locals.marked = require('marked');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
var store = new MongoDBStore(
	{
		uri: 'mongodb://localhost/session_fa',
        collection: 'mySessions'
	}
)
store.on('error', function(error, next){
	next(error)
})
var sess = {
	secret: '12345QWERTY-SECRET',
	name: 'nodecookie',
	resave: false,
	saveUninitialized: false,
	store: store
}
app.use(cookieParser(sess.secret));
if (app.get('env') === 'production') {
	app.set('trust proxy', 1) // trust first proxy
	//app.all('/emergencyservices', es);
}

// session middleware configuration
// see https://github.com/expressjs/session
app.use(session(sess));
app.use(passport.initialize());
app.use(passport.session());
app.use('/publishers', express.static(path.join(__dirname, '../../pu/publishers')));

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

var uri = process.env.DEVDB;

mongoose.connect(uri/*, {authMechanism: 'ScramSHA1'}*/);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

module.exports = app;