router
======

# How to start? #
```javascript
var omuen = require('omuen');
var app = omuen.handle(function(request, response){
  response.end("oMuen, It's works!");
});
app.listen(10100);
```

# How to add a handler #
EZ-MODE: `http://example.com/hello.do`
```javascript
var omuen = require('omuen');
var app = omuen.handle(function(request, response){
  response.end("oMuen, It's works!");
});

app.get("hello.do", function(request, response){  
    var text = "Hello, World!";  
    response.end(text);  
});  
app.listen(10100);
```


or with "get" and "post" to `http://example.com/hello.do`
```javascript
var omuen = require('omuen');
var app = omuen.handle(function(request, response){
  response.end("oMuen, It's works!");
});

app.push("hello.do", omuen.handle({ 
  doGet: function(request, response){ 
    var data = "[GET] Hello, World!"; 
    response.setHeader('Content-Length', data.length); 
    response.end(data); 
  },
  doPost: function(request, response){  
    var data = "[POST] Hello, World!";  
    response.setHeader('Content-Length', data.length);  
    response.end(data);  
  }  
}));   
app.listen(10100);
```

or with "sub-handler" `http://example.com/hello/hello-world.do` and `http://example.com/hello/hi-man.do`
```javascript
var omuen = require('omuen');
var app = omuen.handle(function(request, response){
  response.end("oMuen, It's works!");
});

var hello = omuen.handle();
hello.push("hello-world.do", function(request, response){
  var data = "hello, World";
  response.end(data);
});
hello.push("hi-man.do", function(request, response){
  var data = "Hi, Man!";
  response.end(data);
});

app.push("hello", hello);
app.listen(10100);
```
# How to install #
> npm install omuen
