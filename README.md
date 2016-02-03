router
======

# How to start? #
```javascript
var router = require('router');
var server = http.createServer(function (request, response) {  
  router.handler(request, response);  
});  
```

# How to add a handler #
EZ-MODE:
```javascript
router.root.push("hello.do", function(request, response){  
    var text = "Hello, World!";  
    response.setHeader("Content-Length", Buffer.byteLength(text, 'utf8'));  
    response.end(text);  
});  
```
or with "get" and "post"
```javascript
router.root.push("hello.do", router.handle({ 
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
```
or with "sub-handler"
```javascript
router.root.push("hello", router.handle({
    doCreate: function(){
      this.push("hello-world.do", function(request, response){
        var data = "hello, World";
        response.setHeader('Content-Length', data.length);
        response.end(data);
      });
      this.push("hi-man.do", router.handle({
        doGet: function(request, response){
          var data = "Hi, Man!";
          response.setHeader('Content-Length', data.length);
          response.end(data);
        }
      }));
    }
  })
);
```
