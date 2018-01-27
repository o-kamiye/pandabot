
/**
 * Panda project entry point
 */

var express = require('express');  
var bodyParser = require('body-parser');  
var request = require('request');  
var app = express();

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
		    	console.log('Lat: ' + coordinates.lat + ' Long: ' + coordinates.long);
		    	sendLocationMessage(event.sender.id, event.message.attachments[0]);
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
  }, function(error, response, body) {
      if (error) {
          console.log('Error sending message: ', error);
      } else if (response.body.error) {
          console.log('Error: ', response.body.error);
      }
  });
};

function sendLocationMessage(recipientId, attachment) {
	let text = "Great. Your location is " + attachment.title;
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
  }, function(error, response, body) {
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
	let text = "And yeah!. Your coordinates are: Lat => " + coordinates.lat + " and Long => " + coordinates.long;
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
  }, function(error, response, body) {
      if (error) {
          console.log('Error sending message: ', error);
      } else if (response.body.error) {
          console.log('Error: ', response.body.error);
      }
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