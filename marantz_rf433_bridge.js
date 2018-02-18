var mqtt = require('mqtt');
var rpi433 = require('rpi-433');

rfEmitter = rpi433.emitter({
  pin: 0,                     //Send through GPIO 0 (or Physical PIN 11) 
  pulseLength: 340            //Send the code with a 350 pulse length 
});

var gBuffer = "";
var gCommands = [];

// ---- MQTT

var client = mqtt.connect('mqtt://localhost')

client.on('connect', function (con) {
  console.log('RF433-control message queue connected!', con);

  client.subscribe('rf433/cmd/+')
})

client.on('message', function (topic, message) {
  if (topic.startsWith("rf433/cmd/dec")) {

    var rfcode = parseInt(message.toString());
    console.log("rf433/cmd/dec DEC GOT", rfcode);

    var count = gCommands.push({ rfcode: rfcode, write: false });

    safeWrite();
  }
})

function safeWrite() {

  if (gCommands.length == 0) return;
  var element = gCommands[0];
  if (element.write) return;

  console.log ("element", element);

  element.write = true;
  rfEmitter.sendCode(element.rfcode, function (error, stdout) {   //Send 1234 

    console.log("error", error);
    console.log("stdout", stdout);

    gCommands.shift();

    safeWrite();
  });

}
