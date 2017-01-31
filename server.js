var express = require("express");
var nunjucks = require("nunjucks");
var request = require("request-json");
var url = require("url");
var pusher = require("pusher");
var bodyParser = require("body-parser");
var uuid = require("node-uuid");

var rawBodySaver = function (req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
}

var till_url = url.parse(process.env.TILL_URL);
var pusher_url = url.parse(process.env.PUSHER_URL);

var pusher_token = pusher_url.auth.split(":")[0];
var till_base_url = till_url.protocol + "//" + till_url.host;
var till_send_path = till_url.pathname;

if(till_url.query != null) {
  till_send_path += "?"+till_url.query;
}

var client = request.createClient(till_base_url);
var pclient = pusher.forURL(pusher_url.href);

var app = express();
app.use(bodyParser.json({verify: rawBodySaver}));
app.use(bodyParser.urlencoded({verify: rawBodySaver, extended: true}));
app.use(bodyParser.raw({verify: rawBodySaver, type: function () { return true }}));
nunjucks.configure("templates", {express: app});

// Render UI
app.get("/", function(req, res) {
  var str_uuid = uuid.v1()+"";
  res.render("index.html", {"uuid": str_uuid, "pusher_token": pusher_token});
});

// Send question over SMS
app.post("/send", function(req, res) {
  var data = {
    "phone": [req.body.phone_number],
    "questions" : [{
      "text": "Favorite color?",
      "tag": "favorite_color",
      "responses": ["Red", "Green", "Yellow"],
      "webhook": req.body.webhook_url + "?uuid="+req.body.uuid
    }]
  };

  client.post(till_send_path, data, function(err, res, body) {
    return console.log(res.statusCode);
  });  

  res.json({"status": "success"});
});

// Webhook for results
app.post("/results", function(req, res) {
  pclient.trigger(req.query.uuid, "result", req.body);
  res.json({"status": "success"});
});

// Start server
var server = app.listen(process.env.PORT || 5002, function () {
  console.log("App now running on port", server.address().port);
});
