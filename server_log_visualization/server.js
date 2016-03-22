var app = require('./app');
var debug = require('debug')('app:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '9000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

exports.server = server;

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

var io = require('socket.io').listen(server);

var  time_obj = {}, time = [];

// create a kafkaesqe client, providing at least one broker
var kafkaesque = require('kafkaesque')({
  brokers: [{host: 'localhost', port: 9092}],
  clientId: '1',
  maxBytes: 2000000
});

// tearup the client
kafkaesque.tearUp(function() {

  kafkaesque.poll( {topic: "log-analysis-output", partition: 0} , function(err, kafka) {
    // handle each message
    kafka.on('message', function(offset, message, commit) {
      var temp = message.value.split(',');
      var url = temp[1].split('?')[0];

      if(url.indexOf('v4/search') != -1){
        if(time.indexOf(temp[0]) == -1){
          time.push(temp[0]);
          var labels = [], qps = 0 , data_obj = {} ;

          setTimeObj (labels,data_obj,qps,url,temp);
        }
        else{
          var cur_time_obj = time_obj[temp[0]];
          var labels = time_obj[temp[0]].labels;
          var data_obj = time_obj[temp[0]].data_obj;
          var qps = time_obj[temp[0]].qps;
          setTimeObj (labels,data_obj,qps,url,temp);
        }
      }

      commit();
    });

    kafka.on('error', function(error) {
      console.log(JSON.stringify(error));
    });
  });

});


function setTimeObj (labels,data_obj,qps,url,temp){
  if(url.indexOf('v4/search') != -1){
    qps += parseInt(temp[temp.length -2]);
  }
  if(labels.indexOf(url) == -1){
      labels.push(url);
      data_obj[url] = {
        no_of_req : parseInt(temp[temp.length -2]),
        res_time : parseInt(temp[temp.length -1])
      }
      var min = temp[2];
      var max = temp[3];
  }
  else{
    data_obj[url].no_of_req += parseInt(temp[temp.length -2]);
    data_obj[url].res_time += parseInt(temp[temp.length -1]);
    if(time_obj[temp[0]].min && temp[2] < time_obj[temp[0]].min){
      var min = temp[2];
    }
    if(time_obj[temp[0]].max && temp[3] > time_obj[temp[0]].max){
      var max = temp[3];
    }

  }

  time_obj[temp[0]] = {
    data_obj : data_obj,
    labels :  labels,
    qps : qps,
    min : min || time_obj[temp[0]].min,
    max : max || time_obj[temp[0]].max
  };
}

io.on('connection', function (socket) {
  console.log('connected');
  var count = 0;
  var cur = 0;
  var frequency = 2;
  var labels = [] , minArr =[] , maxArr = [] , avg_res_time = [] , qps = [];
  var interval;
  socket.on('disconnect',function(){
    console.log('disconnected');
    socket.disconnect(true);
    clearInterval(interval);
  });
  //Emit every 5 seconds
  setTimeout(function(){
    interval = setInterval(function(){
      count++;
      for( var i = 0 ; i < 5 && time.length > 0 ; i++){
        var minTime = Math.min.apply(null, time);
        labels.push(minTime);
        minArr.push(parseInt(time_obj[minTime].min)/1000);
        maxArr.push(parseInt(time_obj[minTime].max)/1000);
        qps.push(time_obj[minTime].qps);

        var url_labels = time_obj[minTime].labels;
        var data_obj = time_obj[minTime].data_obj;
        avg_res_time.push(data_obj[url_labels[0]].res_time / data_obj[url_labels[0]].no_of_req / 1000);
        time.splice(time.indexOf(minTime.toString()) ,1);


      }
      if(time.length || labels.length){
        // console.log(qps,'qps');
        // console.log(minArr,'minArr');
        // console.log(maxArr,'maxArr');
        // console.log(avg_res_time,'avg_res_time');

        emitData(socket,labels,minArr,maxArr,avg_res_time,qps);
        labels.shift();
        minArr.shift();
        maxArr.shift();
        avg_res_time.shift();
        qps.shift();
      }


      cur += frequency;

    }, frequency*1000);

  },5000);


});


function emitData(socket,labels,minArr,maxArr,avg_res_time,qps){
  socket.emit('newData',{
    timeframe : labels.slice(0,10),
    min : minArr.slice(0,10),
    max : maxArr.slice(0,10),
    avg_res_time : avg_res_time.slice(0,10),
    qps : qps.slice(0,10)

  });
}
// app.set('io',io);
