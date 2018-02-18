var express = require('express')
var SerialPort = require('serialport');
var mqtt = require('mqtt')

var gBuffer = "";
var gCommands = [];

// ---- express
var app = express()
app.use(express.static('web-build'))

app.listen(80, function () {
  console.log('Marantz WiFi-control listening on port 80!')
})

var client = mqtt.connect('mqtt://localhost')
client.on('message', function (topic, message) {
  console.log("mqtt msg", topic, message);
  if (topic.startsWith("marantz/cmd")) {
    var msg = message.toString();
    var ar = topic.split("/");
    var cmd = ar[ar.length - 1];
    var fullcmd = "@" + cmd + ":" + message + String.fromCharCode(13);

    var count = gCommands.push({ fullcmd: fullcmd, command: cmd, write: false, received: false, response: null, timeout: false });

    safeWrite();
  }
  if (topic.startsWith("rf433/cmd")) {
  }  
})

// ---- serialport
var port = new SerialPort('/dev/ttyS0');
port.on('open', function (con) {
  console.log('Marantz WiFi-control serial-port opened!', port);

}, { baudRate: 9600 });

// open errors will be emitted as an error event
port.on('error', function (err) {
  console.log('Serial Port Error: ', err.message);
})

port.on('data', function (data) {
  if (!data.length) return;

  var str = "" + data;
  for (i = 0; i <= str.length; i++) {
    if (str.charCodeAt(i) > 0) {

      //console.log("->", str.charCodeAt(i));
      if (str.charCodeAt(i) == 13) {
        console.log("serial command received:", gBuffer);
        fExecuteCommand(gBuffer);
        gBuffer = "";
      }
      else {
        gBuffer += str[i];
      }
    }
  }
});

function fExecuteCommand(command) {

  if (command[0] == '@' && command.indexOf(":") > -1) {
    var cmds = command.substring(1, command.length).split(":");
    receive(cmds);
  }
}

// ---- MQTT
client.on('connect', function (con) {
  console.log('Marantz WiFi-control message queue connected!', con);

  client.subscribe('marantz/cmd/+')
})


function safeWrite() {
  if (gCommands.length == 0) return;
  var element = gCommands[0];
  if (element.write) return;
  //if (gCommands.find(function (el) { return (el.write) })) return;

  //var element = gCommands.find(function (el) { return (!el.write) });
  //if (!element) return;

  element.write = true;
  port.write(element.fullcmd, function (err) {
    if (!err) {
      console.log("serial write:", element.fullcmd);
    }
    else
    {
      console.error("serial write err:", err);
    }
  });
  setTimeout(function (el) {
    el.timeout = true;
    if (el.removed) return;

    var index = gCommands.indexOf(el);
    if (index >= 0) {
      console.log("timeout removing...", index, gCommands.length);
      gCommands.splice(index, 1);;

      gCommands.forEach(function(el){console.log(el);})
    }

  }, 1000, element)
}

function receive(cmds) {
  if (gCommands.length == 0) return;

  var element = gCommands.find(function (el) { return (el.write && el.command == cmds[0]) });
  if (!element) return;

  element.received = true;
  element.response = cmds[1];

  client.publish("marantz/rcv/" + cmds[0], cmds[1])
  console.log("publish to marantz/rcv", cmds);

  var index = gCommands.indexOf(element);
  console.log("removing...", index, gCommands.length);
  gCommands.splice(index, 1);
  element.removed = true;

  safeWrite();
}