var http = require('http');
var router = require('router');
var muen = require("muen");
var fs = require("fs");

var PORT = 10010;
var dir_modules = "./modules";
var log = {};
log.error = function(msg){
  console.log("\x1B[93m[%s]\x1B[39m \x1B[91m%s\x1B[39m", muen.now(), msg);  
}
log.info = function(msg){
  console.log("\x1B[93m[%s]\x1B[39m \x1B[96m%s\x1B[39m", muen.now(), msg);  
}
log.success = function(msg){
  console.log("\x1B[93m[%s]\x1B[39m \x1B[92m%s\x1B[39m", muen.now(), msg);  
}
log.write =function(msg){
  console.log("\x1B[93m[%s]\x1B[39m %s", muen.now(), msg);  
}

router.root.push("sso", require("sso"));

fs.readdir(dir_modules, function(err, files) {  
  if (err) {  
    console.log('read dir error');  
  }
  else {  
    var bin = router.root.bin;
    files.forEach(function(fn) {
      var i = fn.indexOf(".js");
      if(i>-1){
        var m = fn.slice(0, i);
        try{
          var o = require(dir_modules + "/" + fn);
          if(o && o.doCreate) {
            log.write("Load Module: \x1B[96m" + m + "\x1B[39m");
            bin.push(m, o);
          }
        }
        catch(e){
          console.log(e.toString());
        }
      }
    });
    log.success("Modules OK.");
  }
});  




var server = http.createServer(function (request, response) {
  router.handler(request, response);
});

var sockets = [];
server.on("connection",function(socket){
  console.log("[" + muen.now() + "] Incoming Connection.");
  sockets.push(socket);
  socket.once("close",function(){
    sockets.splice(sockets.indexOf(socket),1);
  });
});

server.on("request", function(){
  log.write("New Request.");
});

server.on("close", function(){
  log.info("Connection Closed.");
});

server.on("error", function(err){
  log.error(err.toString());
});

server.on("clientError", function(err){
  log.error(err.toString());
});

process.on('exit', function(code) {
  log.error("程序退出，退出代码:" + code);
});

process.on('SIGINT', function() {
  console.log("");
  router.free();
  sockets.forEach(function(socket){
    socket.destroy();
  });
  server.close(function(){
    log.error("服务已关闭!");
  });
});

server.listen(PORT);
log.write("Server runing at port: \x1B[92m" + PORT + "\x1B[39m.");
