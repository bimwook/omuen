var url = require('url');
var fs = require('fs');
var path = require('path');
var qs = require('querystring');
var lite = require('sqlite3').verbose();

var router = {};
router.now = function(format){
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
router.rndnum = function(){
  return ("00000000" + Math.floor(Math.random()*100000000)).slice(-8);
}
router.rndid = function(){
  return this.now("yyyymmddhhnnsszzz") + '-' + this.rndnum() + '-' + this.rndnum();
}
router.log = {};
router.log.error = function(msg){
  console.log("\x1B[93m[%s]\x1B[39m \x1B[91m%s\x1B[39m", router.now(), msg);  
}
router.log.info = function(msg){
  console.log("\x1B[93m[%s]\x1B[39m \x1B[96m%s\x1B[39m", router.now(), msg);  
}
router.log.success = function(msg){
  console.log("\x1B[93m[%s]\x1B[39m \x1B[92m%s\x1B[39m", router.now(), msg);  
}
router.log.write =function(msg){
  console.log("\x1B[93m[%s]\x1B[39m %s", router.now(), msg);  
}

router.getLength = function(string){
  return Buffer.byteLength(string, 'utf8');
}

router.sessions = {};
router.sessions.cache = new lite.Database(":memory:");
router.sessions.timer = null;
router.sessions.set = function(sid, name, value){
  var db = this.cache;
  var dosave = function(rowid, content){
    db.serialize(function() {          
      if(rowid==null){
        var stmt = db.prepare("INSERT INTO [sessions] VALUES (?, ?, ?);");
        stmt.run(sid, JSON.stringify(content), router.now());
        stmt.finalize();          
      }
      else {
        var stmt = db.prepare("UPDATE [sessions] SET [content]=?, [modified]=? WHERE [rowid]=?;");
        stmt.run(JSON.stringify(content), router.now(), rowid);
        stmt.finalize();
      }
    });
  }
    
  var count=0;
  db.serialize(function() {
    db.each(
      "SELECT [rowid], [content] FROM [sessions] WHERE [rowid]='" + (sid||"").replace(/'/g, "''") + "';", 
      function(err, row)
      {
        if(!err) count ++;
        try{
          var content = JSON.parse(row.content)||{};
          content[name]=value;
          dosave(row.rowid, content);
        }
        catch(e){
          var content = {};
          content[name]=value;
          dosave(sid, content);
        }
        
      },
      function(){
        if (count==0) {
          var content = {};
          content[name]=value;          
          dosave(null,content);
        }
      }
    );
  });
}

router.sessions.clear = function(sid){
  db.serialize(function() {
    db.run("DELETE FROM [sessions] WHERE [rowid] = '" + (sid||"").replace(/'/g, "") + "';");
  });
}

router.sessions.find = function(sid, callback){
  var me = this;
  var db = this.cache;
  var count = 0;
  var ret = {};
  ret.sid = sid;
  ret.items = {};
  ret.set = function(name, value){
    me.set(this.sid, name, value);
    this.items[name]=value;
  }
  ret.clear = function(){
    me.clear(this.sid);
  }
  ret.cached = false;
  db.each(
    "SELECT * FROM [sessions] WHERE [rowid]='" + (sid||"").replace(/'/g, "") + "';", 
    function(err, row)
    {
      count ++;
      try{
        ret.items = JSON.parse(row.content);
        ret.cached = true;
        callback(ret);
      }
      catch(e){
        router.log.error(e.toString());
        callback(ret);
      }
    },
    function(){
      if (count==0) callback(ret);
    }
  );
};
router.sessions.start = function(){
  var db = this.cache;
  db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS [meta] ([rowid] PRIMARY KEY, [value]);");
    db.run("CREATE TABLE IF NOT EXISTS [sessions] ([rowid] PRIMARY KEY, [content], [modified]);");
    router.log.write("sessions.start=[\x1B[92mOK\x1B[39m]");
  });
  this.timer = setInterval(function(){
    db.run("DELETE FROM [sessions] WHERE ((julianday('now', 'localtime') - julianday([modified]))*86400)>1200");
  },60000);
  router.log.write("sessions.timer.start = [\x1B[92mOK\x1B[39m]");
}

router.sessions.stop = function(){
  clearInterval(this.timer);
  router.log.write("sessions.stop=[\x1B[92mOK\x1B[39m]");
}

router.sessions.start();

router.reader = function(){
  var ret = {};
  ret.buffers = [];
  ret.length = 0;
  ret.write = function(buffer){
    this.buffers.push(buffer);
    this.length += buffer.length;
    return this.length;
  }
  
  ret.read = function(){
    var p = 0;
    var buffer = new Buffer(this.length);
    for(var i=0; i<this.buffers.length; i++){
      var chunk = this.buffers[i];
      chunk.copy(buffer, p);
      p+=chunk.length;
    }
    return buffer;
  }
  return ret;
};

router.handle = function(opt){
  var me = this;
  var ret = {};
  var opt = opt ||{};
  ret.name = "";
  ret.sessions = function(sid){
    me.sessions.find(sid);
  }
  ret.doGet = typeof(opt.doGet)=="function"? opt.doGet : function(request, response, data){
    var buffer = [];
    buffer.push('<!DOCTYPE html>');
    buffer.push('<html>');
    buffer.push('  <head>');
    buffer.push('    <meta charset="utf-8" />');
    buffer.push('    <title>Index Of ' + this.name + '</title>');
    buffer.push('    <style type="text/css">');
    buffer.push('      html{');
    buffer.push('        margin:0;');
    buffer.push('        padding:0;');
    buffer.push('        text-align:center;');
    buffer.push('        font: normal 14px/1.5 verdana;');
    buffer.push('        background-color: silver;'); 
    buffer.push('      }');
    buffer.push('      body{');
    buffer.push('        margin:0 auto;');
    buffer.push('        padding:0;');
    buffer.push('        text-align: left;');    
    buffer.push('        width: 980px;');
    buffer.push('        background-color: white;'); 
    buffer.push('      }');
    buffer.push('      h1{');
    buffer.push('        position: relative;');    
    buffer.push('        margin:0;');
    buffer.push('        padding:0 24px;');
    buffer.push('        font: bold 18px/2.5 verdana;');
    buffer.push('        background-color: #EAEAEA;');    
    buffer.push('      }');    
    buffer.push('      hr{');
    buffer.push('        margin:0;');
    buffer.push('        padding:0;');
    buffer.push('        border: none;');
    buffer.push('        height: 1px;');
    buffer.push('        background-color: gray;');
    buffer.push('      }');
    buffer.push('      div{');
    buffer.push('        margin:0;');
    buffer.push('        padding:0;');
    buffer.push('      }');
    buffer.push('      ul{');
    buffer.push('        margin:0;');
    buffer.push('        padding:16px;');
    buffer.push('        list-style: none;');    
    buffer.push('      }');
    buffer.push('      ul li{');
    buffer.push('        margin:4px 0;');
    buffer.push('        padding: 0;'); 
    buffer.push('        background-color: #FAFAFA;'); 
    buffer.push('        border-left:solid 4px silver;'); 
    buffer.push('      }');
    buffer.push('      ul li:hover{');
    buffer.push('        border-left:solid 4px #00C0C0;'); 
    buffer.push('      }');
    buffer.push('      a, a:link, a:visited{');
    buffer.push('        display: block;');    
    buffer.push('        color: #383838;');
    buffer.push('        padding: 4px 8px;');
    buffer.push('        text-decoration: none;');    
    buffer.push('      }');    
    buffer.push('      a:hover{');
    buffer.push('        color: #00C0C0;');
    buffer.push('      }');    
    buffer.push('      .small{');
    buffer.push('        color: gray;');
    buffer.push('        font: normal 0.8rem/1 verdana;');
    buffer.push('      }');    
    buffer.push('      h1 .copyright{');
    buffer.push('        position:absolute;');
    buffer.push('        right: 16px;');
    buffer.push('        bottom: 4px;');
    buffer.push('      }');    
    buffer.push('    </style>');
    buffer.push('  </head>');
    buffer.push('  <body>');
    buffer.push('    <h1><span>Index Of ' + this.name + '</span><span class="small copyright">Powered By [com.bimwook.router/v1.0]</span></h1>');
    buffer.push('    <hr />');
    buffer.push('    <ul>');
    for(var k in this.items){
      buffer.push('      <li><a href="' + (this.name=="/"?"":this.name) + '/' + k + '" target="_blank">' + k + '</a></li>');
    }
    buffer.push('    </ul>');
    buffer.push('    <hr/>');
    buffer.push('    <div class="small" style="padding:8px 16px;">访问时间: ' + router.now() + '</div>');        
    buffer.push('  </body>');
    buffer.push('</html>');
    var html = buffer.join("\r\n");
    response.setHeader('Content-Type' , 'text/html');
    response.setHeader("Content-Length", Buffer.byteLength(html, 'utf8'));
    response.end(html);
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
      hdl = me.handle({doGet: handler});
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
  return ret;
}
router.root = router.handle({});

router.root.name = "/";

var diskfiles = router.handle({
  doGet: function(request, response){
    var address = url.parse(request.url);
    var pn = address.pathname;
    var fn = path.join("./", pn);
    var mime = {
      "css" : "text/css",
      "gif" : "image/gif",
      "htm" : "text/html",
      "html" : "text/html",
      "ico" : "image/x-icon",
      "jpeg" : "image/jpeg",
      "jpg" : "image/jpeg",
      "js" : "text/javascript",
      "json" : "application/json",

      "pdf" : "application/pdf",
      "png" : "image/png",
      "svg" : "image/svg+xml",
      "swf" : "application/x-shockwave-flash",
      "tiff" : "image/tiff",
      "txt" : "text/plain",
      "wav" : "audio/x-wav",
      "wma" : "audio/x-ms-wma",
      "wmv" : "video/x-ms-wmv",
      "xml" : "text/xml"
    };
    var ext = path.extname(fn);
    ext = ext ? ext.slice(1) : 'unknown';
    fs.exists(fn, function (exists) {
      if (!exists) {
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/plain');
        response.end("404 Not Found");
      } 
      else {
        fs.stat(fn, function(err, stats){
          if(stats.isDirectory()){
            fs.readdir(fn, function(err, files){
              var buffer = [];
              buffer.push('<!DOCTYPE html>');
              buffer.push('<html>');
              buffer.push('  <head>');
              buffer.push('    <meta charset="utf-8" />');
              buffer.push('    <title>Index Of ' + pn + '</title>');
              buffer.push('    <style type="text/css">');
              buffer.push('      html{');
              buffer.push('        margin:0;');
              buffer.push('        padding:0;');
              buffer.push('        text-align:center;');
              buffer.push('        font: normal 14px/1.5 verdana;');
              buffer.push('        background-color: silver;');    
              buffer.push('      }');
              buffer.push('      body{');
              buffer.push('        margin:0 auto;');
              buffer.push('        padding:0;');
              buffer.push('        text-align: left;'); 
              buffer.push('        background-color: white;');    
              buffer.push('        width: 980px;');
              buffer.push('      }');
              buffer.push('      h1{');
              buffer.push('        position: relative;');    
              buffer.push('        margin:0;');
              buffer.push('        padding:0 24px;');
              buffer.push('        font: bold 18px/2.5 verdana;');
              buffer.push('        background-color: #EAEAEA;');    
              buffer.push('      }');    
              buffer.push('      hr{');
              buffer.push('        margin:0;');
              buffer.push('        padding:0;');
              buffer.push('        border: none;');
              buffer.push('        height: 1px;');
              buffer.push('        background-color: gray;');
              buffer.push('      }');
              buffer.push('      div{');
              buffer.push('        margin:0;');
              buffer.push('        padding:0;');
              buffer.push('      }');
              buffer.push('      ul{');
              buffer.push('        margin:0;');
              buffer.push('        padding:16px;');
              buffer.push('        list-style: none;');    
              buffer.push('      }');
              buffer.push('      ul li{');
              buffer.push('        margin:4px 0;');
              buffer.push('        padding: 0;'); 
              buffer.push('        background-color: #FAFAFA;'); 
              buffer.push('        border-left:solid 4px silver;'); 
              buffer.push('      }');
              buffer.push('      ul li:hover{');
              buffer.push('        border-left:solid 4px #00C0C0;'); 
              buffer.push('      }');
              buffer.push('      a, a:link, a:visited{');
              buffer.push('        display: block;');    
              buffer.push('        color: #383838;');
              buffer.push('        padding: 4px 8px;');
              buffer.push('        text-decoration: none;');    
              buffer.push('      }');    
              buffer.push('      a:hover{');
              buffer.push('        color: #00C0C0;');
              buffer.push('      }');    
              buffer.push('      .small{');
              buffer.push('        color: gray;');
              buffer.push('        font: normal 0.8rem/1 verdana;');
              buffer.push('      }');    
              buffer.push('      h1 .copyright{');
              buffer.push('        position:absolute;');
              buffer.push('        right: 16px;');
              buffer.push('        bottom: 4px;');
              buffer.push('      }');    
              buffer.push('    </style>');
              buffer.push('  </head>');
              buffer.push('  <body>');
              buffer.push('    <h1><span>Index Of ' + pn + '</span><span class="small copyright">Powered By [com.bimwook.router/v1.0]</span></h1>');
              buffer.push('    <hr />');
              buffer.push('    <ul>');
              files.forEach(function(fn) {
                buffer.push('      <li><a href="' + pn + '/' + fn + '" target="_blank">' + fn + '</a></li>');
              });                                
              buffer.push('    </ul>');
              buffer.push('    <hr/>');
              buffer.push('    <div class="small" style="padding:8px 16px;">访问时间: ' + router.now() + '</div>');        
              buffer.push('  </body>');
              buffer.push('</html>');
              var html = buffer.join("\r\n");
              response.setHeader('Content-Type' , 'text/html');
              response.setHeader("Content-Length", Buffer.byteLength(html, 'utf8'));
              response.end(html);

            });              
          }
          else{
            fs.readFile(fn, "binary", function (err, file) {
              if (err) {
                response.setHeader('Content-Type', 'text/plain');
                response.end(err);
              } 
              else {
                var contentType = mime[ext] || "text/plain";
                response.setHeader('Content-Type', contentType);
                response.setHeader('Content-Length', Buffer.byteLength(file, 'binary'));
                response.end(file, "binary");
              }
            });
          }
        })
      }
    });
  },
  doPost: function(request, response){
    this.doGet(request, response);
  }
});

router.root.push("home", diskfiles);
router.root.push("var", diskfiles);

router.root.push("bin", router.handle({
    doCreate: function(){
      this.push("now.do", function(request, response){
        var data = router.now();
        response.setHeader('Content-Length', data.length);
        response.end(data);
      });
      this.push("rndid.do", router.handle({
        doGet: function(request, response){
          var data = router.now("yyyymmddhhnnsszzz") +  ("00000000" + Math.floor(Math.random()*100000000)).slice(-8);
          response.setHeader('Content-Length', data.length);
          response.end(data);
        }
      }));
    }
  })
);

router.root.push(
  "about.do", 
  function(request, response){
    var buffer = [];
    buffer.push('------------------------------------');
    buffer.push("  Router v1.0");
    buffer.push("  By Bamboo [bimwook@foxmail.com]");
    buffer.push('------------------------------------');
    buffer.push('  访问时间:' + router.now());

    var text = buffer.join("\r\n");
    response.setHeader("Content-Length", Buffer.byteLength(text, 'utf8'));
    response.end(text);
  }
);

router.root.push(
  "favicon.ico", 
  function(request, response){
    var address = url.parse(request.url);
    var pn = address.pathname;
    var rp = "." + path.join(pn);
    fs.exists(rp, function (exists) {
      if (!exists) {
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/plain');
        response.end("404 Not Found");
      } 
      else {
        fs.stat(rp, function(err, stats){
          if(stats.isDirectory()){
            response.statusCode = 404;
            response.setHeader('Content-Type', 'text/plain');
            response.end("404 Not Found");              
          }
          else{
            fs.readFile(rp, "binary", function (err, file) {
              if (err) {
                response.statusCode = 200;
                response.setHeader('Content-Type', 'text/plain');
                response.end(err);
              } 
              else {
                var contentType = "image/x-icon";
                response.setHeader('Content-Type', contentType);
                response.setHeader('Content-Length', Buffer.byteLength(file, 'binary'));
                response.end(file, "binary");
              }
            });
          }
        })
      }
    });
  }
);

router.root.bin = router.root.find("bin");

router.handler = function(request, response){
  var me = this;
  var address = url.parse(request.url);
  var path = address.pathname;
  var h = this.root.find(path.slice(1));
  console.log("\x1B[93m[%s]\x1B[39m \x1B[92m%s\x1B[39m:\x1B[96m%s\x1B[39m", router.now(), request.method, path);
  console.log("User-Agent: " + request.headers["user-agent"]);
  if(h){
    response.statusCode = 200;
    response.setHeader('Server', 'bimwook.node.router');
    response.setHeader('X-Powered-By', 'outer v0.0.1');
    response.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    var data = {querystring:null, form: null};
    data.querystring = qs.parse(address.query);
    data.cookies = {};
    var cookies=request.headers["cookie"];
    cookies && cookies.split(';').forEach(function(cookie){
      var kv = cookie.split('=');
      data.cookies[kv[0].trim()]=(kv[1] || '' ).trim();
    });
    var sid = data.cookies["sid"]|| me.rndid();
    me.log.write("sid: \x1B[96m" + sid + "\x1B[39m");
    me.sessions.find(sid, function(session){
      if(!session.cached){
        response.setHeader('Set-Cookie', 'sid=' + me.rndid() + "; path=/;");
      }
      data.session = session;      
      switch(request.method){
        case "GET": {
          try{
            h.doGet(request, response, data);
          }
          catch(e){
            console.log("ERROR: \x1B[91m%s\x1B[39m", e.toString());
          }
          break;
        }
        case "POST" :{
          var buffer = me.reader();
          request.on("data", function(chunk){
            buffer.write(chunk);
          });
          request.on("end", function(){  
            try{ 
              data.form = qs.parse(buffer.read().toString());
              data.binary = buffer.read();        
              h.doPost(request, response, data);
            }
            catch(e){
              console.log("ERROR: \x1B[91m%s\x1B[39m", e.toString());
            }
          })
        
          break;
        }
      }    
    });    
  }
  else{
    response.write("404");
    response.end();
  }
};

router.folders= {};
router.folders.items={};
router.folders.check = function(folder){
  var log = router.log;
  fs.exists(folder, function (exists) {
    if (!exists) {
      fs.mkdir(folder, function(err){
        if(err){
          log.write("CREATE-SYSTEM-FOLDER: [\x1B[91mFAILED\x1B[39m] " + folder );        
        }
        else{
          log.write("CREATE-SYSTEM-FOLDER:     [\x1B[92mOK\x1B[39m] " + folder);
        }
      });
    } 
    else {
      fs.stat(folder, function(err, stats){
        if(err){
          log.write("SYSTEM-FOLDER: [\x1B[91mFAILED\x1B[39m] " + folder ); 
        }
        else if(stats.isDirectory()){
          log.write("SYSTEM-FOLDER:     [\x1B[92mOK\x1B[39m] " + folder);
        }
        else {
          log.write("SYSTEM-FOLDER: [\x1B[91mFAILED\x1B[39m] " + folder );        
        }
      })
    }
  });
};

router.folders.init = function(){
  this.items["modules"] = "./modules";
  this.items["home"] = "./home";
  this.items["var"] = "./var";
  this.items["dbase"] = "./dbase";
  for(var key in this.items){
    this.check(this.items[key]);
  }
}
router.folders.init();
router.free = function(){
  this.sessions.stop();
}

module.exports = router;
