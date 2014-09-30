var muen = {};

muen.rndid = function(){
  var ret = [];
  d = new Date();
  ret.push( d.getFullYear() );
  ret.push( ( "00" + (d.getMonth()+1) ).slice(-2) );
  ret.push( ("00" + d.getDate()).slice(-2) );
  ret.push( ("00" + d.getHours()).slice(-2) );
  ret.push( ("00" + d.getMinutes()).slice(-2 ));
  ret.push( ("00" + d.getSeconds()).slice(-2) ); 
  ret.push( ("000" + d.getMilliseconds()).slice(-3) ); 
  ret.push( ("00000000" + Math.floor(Math.random()*100000000)).slice(-8) );
  return ret.join("");  
}

muen.now = function(format){
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
}

muen.run = function(f){
  if(typeof(f)=="function") {
    f();
  }
}

muen.url = function(url){
  var reg = {path: /([^\?#]+)(\??[^#]*)(#?.*)/};
  var ret = {};
  ret.href = url;
  var t = reg.path.exec(url);
  if (t.length > 3) {
    ret.path = t[1];
    ret.search = t[2];
    ret.hash = t[3];
  }
  return ret;
}


module.exports = muen;
