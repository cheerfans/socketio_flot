
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , config = require('./config')

var app = module.exports = express.createServer();
function gt() {
	return (new Date()).getTime()-18000000;
}

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', {layout:false, pretty:true});
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', routes.index);
app.get('/flot', routes.flot);

var io=require('socket.io').listen(app);
app.listen(3000);
var spawn=require('child_process').spawn, limit=config.limit, interval=config.interval, load=[], all_d={d1:[], d5:[], d15:[]}; // use all_d to hold config.limit number of data sets for initial connections
function parse_uptime(data) {
	// input example: 9:49  up 21 mins, 3 users, load averages: 0.12 0.26 0.23
	var m=/.*load averages: (.*) (.*) (.*)/.exec(data);
	if(m) {
		var f=[], ts=(new Date()).getTime();
		for(var i=1,l=m.length;i<l;i++) {
			f.push( [ts, parseFloat(m[i])] );
		}
		return f;
	} else {
		return null;
	}
}
(function schedule() {
	setTimeout( function () {
		var uptime=spawn('uptime', null);
		uptime.stdout.setEncoding('utf8');
		uptime.stdout.on('data', function(data) {
			//console.log('getting :'+data);
			load=parse_uptime(data);
			if(load) {
				all_d.d1.push(load[0]);
				all_d.d5.push(load[1]);
				all_d.d15.push(load[2]);
				if(all_d.d1.length>limit) {
					all_d.d1.slice(1);
					all_d.d5.slice(1);
					all_d.d15.slice(1);
				}
				io.sockets.emit('newdata', load);
			}
		});
		schedule();
	}, interval*1000);
})();
io.sockets.on('connection', function(socket) {
	socket.emit('init', {interval:interval, limit:limit});
	if(all_d.d1.length>0) {
		socket.emit('history', all_d);
	}
	socket.on( 'reqint', function(d) {
		if(!isNaN(d)) {
			interval=d;
			console.log('setting update interval to %d.', d);
		}
		socket.broadcast.emit('setint', d);
	});
});
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
