const fs = require('fs');
const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);

let data = fs.readFileSync('campus.json');
var parsedData = JSON.parse(data);

server.listen(8080);

io.on('connection', function (socket) {
  function makeIterator(array){
    var nextIndex = 0;
    return {
      next: function(){
        return nextIndex < array.length ?
          {value: array[nextIndex++], done: false} :
          {done: true};
      }
    }
  }

  var it = makeIterator(parsedData);

  p();

  function p() {
    if (it.next().done)
      it = makeIterator(parsedData);
    socket.emit('t', it.next().value);
    setTimeout(p, 500);
  }
});
