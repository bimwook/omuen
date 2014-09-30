var muen = require('./muen');
var router = require('./router');
var http = require('http');
var PORT = 11520;
var bin = router.root.bin;

var cache = router.createHandler();
cache.addItem("save.do", router.createHandler({
  doGet: function(request, response){
    response.end("GET:" + this.name);
  },
  doPost: function(request, response, data){
    response.write(data);
    response.end("POST:" + this.name);
  }
}));

cache.addItem("load.do", function(request, response){
  response.end("GET:" + this.name);
});

bin.addItem("cache", cache);

var server = http.createServer(function (request, response) {
  //console.log(request);
  router.handler(request, response);
});

var sockets = [];
server.on("connection",function(socket){
  sockets.push(socket);
  socket.once("close",function(){
    sockets.splice(sockets.indexOf(socket),1);
  });
});

process.on('exit', function(code) {
  console.log('About to exit with code:', code);
});

process.on('SIGINT', function() {
  //router.free();
  sockets.forEach(function(socket){
    socket.destroy();
  });
  server.close(function(){
    console.log("close server!");
  });
});

server.listen(PORT);
console.log("Server runing at port: " + PORT + ".");
