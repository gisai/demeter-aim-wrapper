var express = require('express');
var router = express.Router();
const Jtr = require("@ptkdev/json-token-replace");
const jtr = new Jtr();
require('log-timestamp');

var queryLimit = 20 ; //We stablish this limit in the number of observations to return, to ease server's load
 

/* GET home page. */
router.get('/aim/v1/getdevicedata', function(req, res, next) {
  console.log(`New getdevicedata request. Device: ${req.params.device} From: ${req.params.from} To: ${req.params.to} Limit: ${req.params.limit} `);
  
  if (req.params.limit && parseInt(req.params.limit)<queryLimit) queryLimit = parseInt(req.params.limit);

  //First observation
  let json_mask = {
    "device" : "node01",
    "device-location" : "POINT(45.75 4.85)",
    "observation" : "obs-1514810172",  
    "timestamp" :  "2021-08-01T12:36:12Z",
    "result-temp":  "0.27121272683143616",
    "result-hum":  "20.27121272683143616",
    "result-co2":  "0.27121272683143616",
    "result-tvoc":  "0.27121272683143616"

  }
  let resultjson = jtr.replace(json_mask, require("../templates/Pilot-5.2-Codan-TempHumCO2.json"), "{{", "}}");

  //Second observation:

json_mask["observation"] = "obs-10000";
json_mask["timestamp"] = "2021-08-02T02:01:31Z";

resultjson["@graph"] = resultjson["@graph"].concat(jtr.replace(json_mask, require("../templates/Pilot-5.2-Codan-TempHumCO2_observation.json"), "{{", "}}")["@graph"]);


  res.json(resultjson);
});

module.exports = router;
