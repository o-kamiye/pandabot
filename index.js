
/**
 * Panda project entry point
 */

var express = require('express');  
var bodyParser = require('body-parser');  
var request = require('request');  
var app = express();
let axios = require('axios');
let http = require('http');
let https = require('https');
const api_endpoint = 'https://panda-bot.herokuapp.com/api/search';
const search_endpoint = 'https://panda-bot.herokuapp.com/api/journey';

axios.create({
	//60 sec timeout
  timeout: 60000,

  //keepAlive pools and reuses TCP connections, so it's faster
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  
  //follow up to 10 HTTP 3xx redirects
  maxRedirects: 10,
  
  //cap the maximum content length we'll accept to 50MBs, just in case
  maxContentLength: 50 * 1000 * 1000,

  headers: {'Content-Type': 'application/json'},

  transformResponse: [function (data) {
    // Do whatever you want to transform the data
 
    return data;
  }]

});

const PAGE_TOKEN = "EAAdGg6fq9UcBALP0ZCBuCFC3miDUBqymR9oOP5kSt8a2N2YZB9r2RemtmRmUAkpFwWZCQyZBKissAz6qfbpqB4u3JyKL35eFS5H0LUdtYkPuQAHwqTuvZCnqKqIXsZCR0nJRLLkukH1tZCeZAsd0OGZCD7jN9XkRVZArG5sEZBAGPm9yAZDZD";

app.use(bodyParser.urlencoded({extended: false}));  
app.use(bodyParser.json());  
app.listen((process.env.PORT || 8888));

// Server frontpage
app.get('/', function (req, res) {  
    res.send('Welcome to PandaBot Server 🐼 🐼');
});

// Facebook Webhook
app.get('/panda/webhook', function (req, res) {  
    if (req.query['hub.verify_token'] === 'testbot_verify_token') {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Invalid verify token');
    }
});

app.post('/panda/webhook', function (req, res) {  
    var events = req.body.entry[0].messaging;
    for (i = 0; i < events.length; i++) {
        var event = events[i];
        //console.log(event);
        if (hasCoordinates(event)) {
        	var coordinates = event.message.attachments[0].payload.coordinates;
		    	sendLocationMessage(event.sender.id, event.message.attachments[0]);
        }
        else if (hasDirectionsPayload(event)) {
        	getJourneyDirection(event.sender.id, event.postback.payload);
        }
        else if (event.message && event.message.text) {
            sendMessage(event.sender.id, {text: "Echo: " + event.message.text});
        }
    }
    res.sendStatus(200);
});

// generic function sending messages
function sendMessage(recipientId, message) {
	let text = "Hello, I can get you to the closest health facility as fast and safe as possible for your maternity needs. \n\nSimply tell me where you are.";
  request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: PAGE_TOKEN},
      method: 'POST',
      json: {
          recipient: {id: recipientId},
          message: {
          	"text": text,
          	"quick_replies":[
				      {
				        "content_type":"location"
				      }
				    ]
          },
      }
  }, (error, response, body) => {
      if (error) {
          console.log('Error sending message: ', error);
      } else if (response.body.error) {
          console.log('Error: ', response.body.error);
      }
  });
};

function sendLocationMessage(recipientId, attachment) {
	let text = "Great! I've got your location. I'm now bringing you the closest healthcare...";
  request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: PAGE_TOKEN},
      method: 'POST',
      json: {
        recipient: {id: recipientId},
        message: {
        	"text": text
        },
      }
  }, (error, response, body) => {
      if (error) {
          console.log('Error sending message: ', error);
      } else if (response.body.error) {
          console.log('Error: ', response.body.error);
      } else {
      	sendFurtherLocationMessage(recipientId, attachment.payload.coordinates);
      }
  });
}

function sendFurtherLocationMessage(recipientId, coordinates) {
	let lat = coordinates.lat;
	let long = coordinates.long;
	axios.get(api_endpoint + '?latitude=' + lat + '&' + 'longitude=' + long).then((response) => {
		if (response.status == 200) {
			let locations = response.data.data;
			let current_location = response.data.current_location;
			let elements = [];
			for (var i = 0; i < locations.length; i++) {
				let locationPhone = locations[i].phone;
				let phone = "";
				if (locationPhone != null) {
					let phoneArray = locations[i].phone.split(" ");
					for (var j = 0; j < phoneArray.length; j++) {
						if (phoneArray[j].match(/[a-z]/i)) break;
						phone += phoneArray[j];
					}
				}
				let openInfo = (locations[i].is_always_open) ? "Open 24 hours" : "Open 12 hours";
				let title = locations[i].name + ' (' + openInfo + ')'; 
				let subtitle = locations[i].address;
				let payload = {
					'current_location': {
						'long': current_location[0],
						'lat': current_location[1]
					},
					'place_location': {
						'long': locations[i].location.longitude,
						'lat': locations[i].location.latitude
					}
				}; 
				let payloadString = JSON.stringify(payload);
				let healthcare = {
						'title': title,
						'subtitle': subtitle,
						'image_url': locations[i].picture,
						'buttons' : [
							{
								'type' : 'phone_number',
								'title' : 'Call ' + locations[i].name,
								'payload' : phone
							},
							{
							  "type": "postback",
							  "title": "Get directions",
							  "payload": payloadString
							}
						]
          }
				elements.push(healthcare);
			}
			request({
	      url: 'https://graph.facebook.com/v2.6/me/messages',
	      qs: {access_token: PAGE_TOKEN},
	      method: 'POST',
	      json: {
          recipient: {id: recipientId},
          message: {
				    "attachment": {
				      "type": "template",
				      "payload": {
				        "template_type": "generic",
				        "image_aspect_ratio": "square",
				        "elements": elements  
				      }
				    }
				  }
	      }
		  }, (error, response, body) => {
	      if (error) {
	          console.log('Error sending message: ', error);
	      } else if (response.body.error) {
	          console.log('Error: ', response.body.error);
	      }
		  });
		}
		else {
			console.log(response.data);
		}
	})
	.catch((err) => {
		console.log(err);
	});
}

function getJourneyDirection(recipientId, payloadString) {
	let payload = JSON.parse(payloadString);

	axios.post(search_endpoint, {
		origin: [payload.current_location.long, payload.current_location.lat],
		destination: [payload.place_location.long, payload.place_location.lat] 
	})
	.then((response) => {
		if (response.status == 200) {
			let journey = response.data.data[0];
			let approxTime = journey.total_duration;
			let approxDistance = journey.total_distance;
			let distanceInKm = Math.floor(approxDistance/1000);
			let actualDistance = '';
			if (distanceInKm > 0) actualDistance = distanceInKm + 'km';
			else actualDistance = approxDistance + 'metres';
			approxTime = 'You should get to the hospital in about ' + Math.floor(approxTime/60) + ' mins';
			approxDistance = 'Total distance is about ' + actualDistance;
			let instructions = '';
			let legs = journey.legs;
			for (var i = 0; i < legs.length; i++) {
				let nextStep = i + 1;
				if (i == 0) { // first
					instructions += "Step " + nextStep + ': ' + legs[i].recommended;
					if (legs.length > 1 && legs[i + 1].stage) {
						let stageArray = legs[i + 1].stage.split("to");
						instructions += ' to ' + stageArray[0] + '\n\n';
					}
				}
				else if (i == legs.length - 1) { // last
					instructions += "Step " + nextStep + ': ' + legs[i].recommended + ' to your destination';
				}
				else { // in between
					if(((typeof legs[i].stage != "undefined") &&
					     (typeof legs[i].stage.valueOf() == "string")) &&
					    (legs[i].stage.length > 0)) {
						let fromStage = legs[i].stage.split("to");
						instructions += 'Step ' + nextStep + ': From ' + fromStage[0] + ' ' + legs[i].recommended;
						instructions += ' to ' + fromStage[1] + '\n\n';
					}
					else {
						instructions += 'Step ' + nextStep + ': It seems you need to ask arond from here 🙈';
					}
				}
			}
			let final_instructions = approxTime + '\n\n' + approxDistance + '\n\n' + instructions;
			request({
	      url: 'https://graph.facebook.com/v2.6/me/messages',
	      qs: {access_token: PAGE_TOKEN},
	      method: 'POST',
	      json: {
	        recipient: {id: recipientId},
	        message: {
	        	"text": final_instructions
	        },
	      }
		  }, (error, response, body) => {
	      if (error) {
	          console.log('Error sending message: ', error);
	      } else if (response.body.error) {
	          console.log('Error: ', response.body.error);
	      }
		  });
		}
		else {
			console.log(response.data);
		}
	})
	.catch((err) => {
		console.log(err)
	});
}

function hasCoordinates(event) {
  if (event.message && event.message.attachments 
  	&& event.message.attachments[0].payload
  	&& event.message.attachments[0].payload.coordinates) {
  	return true;
  }
  return false;
}

function hasDirectionsPayload(event) {
	if (event.postback 
		&& event.postback.payload) {
		return true;
	}
	return false;
}
