var qs = require('querystring');
var URL = require('url');

var omuen = {};
omuen.now = function(format){
  var d = new Date();
  var ret = format;
  if (!(typeof (ret) == "string"))
  {
    //ret = "yyyy-mm-dd hh:nn:ss.zzz";
    ret = "yyyy-mm-dd hh:nn:ss";
  }
  return ret
    .replace(/yyyy/ig, d.getFullYear())
    .replace(/mm/ig, ("00" + (d.getMonth() + 1)).slice(-2))
    .replace(/dd/ig, ("00" + d.getDate()).slice(-2))
    .replace(/hh/ig, ("00" + d.getHours()).slice(-2))
    .replace(/nn/ig, ("00" + d.getMinutes()).slice(-2))
    .replace(/ss/ig, ("00" + d.getSeconds()).slice(-2))
    .replace(/zzz/ig, ("000" + d.getMilliseconds()).slice(-3))  
};

omuen.handle = function(opt){
  var ret = {};
  if(typeof(opt)=="function"){
    opt = {doGet: opt};
  }
  var opt = opt ||{};
  ret.name = "";
  ret.doGet = typeof(opt.doGet)=="function"? opt.doGet : function(request, response, data){
    response.write("Index Of " + this.name + "\r\n");
    for(var k in this.items){
      response.write(k + "\r\n");
    }
    response.end();
  };
  ret.doPost = typeof(opt.doPost)=="function"? opt.doPost : function(request, response, data){
    this.doGet(request, response, data);
  };
  ret.doCreate = typeof(opt.doCreate)=="function"? opt.doCreate : function(){};
  ret.doDestroy = typeof(opt.doDestroy)=="function"? opt.doDestroy : function(){};
  ret.items = {};
  ret.push = function(name, handler){
    var hdl = handler;
    if(typeof(handler)=="function"){
      hdl = omuen.handle({doGet: handler, doPost: handler});
    }
    hdl.name = name;
    hdl.doCreate();
    this.items[name] = hdl;
  }
  ret.get = function(name, handler){
    var hdl = handler;
    if(typeof(handler)=="function"){
      hdl = omuen.handle({doGet: handler});
    }
    hdl.name = name;
    hdl.doCreate();
    this.items[name] = hdl;
  }
  ret.post = function(name, handler){
    var hdl = handler;
    if(typeof(handler)=="function"){
      hdl = omuen.handle({doPost: handler});
    }
    hdl.name = name;
    hdl.doCreate();
    this.items[name] = hdl;
  }
  ret.find = function(path){
    var p = path.indexOf("/");
    var mname = (p==-1) ? path : path.slice(0,p);  
    var item = this.items[mname];
    if(item){
      return item.find(path.slice(p+1));
    }
    return this;
  }
  
  ret.execute = function(request, response){
    var url = URL.parse(request.url);
    var path = url.pathname;
    var h = this.find(path.slice(1))||this;

    if(h){
      var data = {querystring:null, form: null};
      data.querystring = qs.parse(url.query);
      response.writeHead(200, {
        'Server' : 'omuen/1.0',
        'X-Powered-By' : 'omuen v0.0.1',
        'Content-Type' : 'text/plain; charset=UTF-8'
      });
      switch(request.method){
        case "GET": {
          h.doGet(request, response, data);
          break;
        }
        case "POST" :{
          var buffer = "";
          request.on("data", function(chunk){
            buffer += chunk;
          });
          request.on("end", function(){   
            data.form = qs.parse(buffer);        
            h.doPost(request, response, data);
          })
        
          break;
        }
      }
      
    }
    else{
      response.write("404");
      response.end();
    }  
  }
  
  ret.listen = function(port){
    var me = this;
    var http = require('http');
    var server = http.createServer(function (request, response) {  
      me.execute(request, response);  
    });

    var log = {};
    log.error = function(msg){
      console.log("\x1B[93m[%s]\x1B[39m \x1B[91m%s\x1B[39m", omuen.now(), msg);
    }
    log.info = function(msg){
      console.log("\x1B[93m[%s]\x1B[39m \x1B[96m%s\x1B[39m", omuen.now(), msg);
    }
    log.success = function(msg){
      console.log("\x1B[93m[%s]\x1B[39m \x1B[92m%s\x1B[39m", omuen.now(), msg);
    }
    log.write =function(msg){
      console.log("\x1B[93m[%s]\x1B[39m %s", omuen.now(), msg);
    }  
    
    
    
    var sockets = [];
    server.on("connection",function(socket){
      console.log("[" + omuen.now() + "] Incoming Connection.");
      sockets.push(socket);
      socket.once("close",function(){
        sockets.splice(sockets.indexOf(socket),1);
      });
    });

    server.on("request", function(){
      //log.write("New Request.");
    });

    server.on("close", function(){
      log.info("Connection Closed.");
    });

    server.on("error", function(err){
      log.error(err.toString());
      if(err.code = 'EADDRINUSE'){
        process.exit(500);
      }
    });

    server.on("clientError", function(err){
      log.error(err.toString());
    });

    process.on('exit', function(code) {
      log.error("程序退出，退出代码:" + code);
    });

    process.on('SIGINT', function() {
      console.log("");
      sockets.forEach(function(socket){
        socket.destroy();
      });
      server.close(function(){
        log.error("服务已关闭!");
      });
    });
    server.listen(port);
    
    console.log("oMuen runing at port: \x1B[92m%s\x1B[39m.", port); 
  };
  
  return ret;
}

module.exports = omuen;
