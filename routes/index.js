var express = require('express');
var router = express.Router();
const Jtr = require("@ptkdev/json-token-replace");
const jtr = new Jtr();
require('log-timestamp');
const { Pool } = require('pg');
const { json } = require('express');
const pool = new Pool({connectionString: 'postgresql://crate@localhost:5432/doc'})

var queryLimit = 20 ; //We stablish this limit in the number of observations to return, to ease server's load
 

/* GET home page. */
router.get('/aim/v1/getdevicedata', function(req, res, next) {
  console.log(`New getdevicedata request. Device: ${req.query.device} From: ${req.query.from} To: ${req.query.to} Limit: ${req.query.limit} `);
  if (!req.query.device) return res.json({Error: "device parameter is required, try with nodo1"});

  if (req.query.limit && parseInt(req.query.limit)<queryLimit) queryLimit = parseInt(req.query.limit);

  let json_mask = {};

   //If device exists 
   switch (req.query.device){
    case "nodo1":
      json_mask["device"] = req.query.device;
      json_mask["device-location"] = "POINT(45.75 4.85)";
      break;
    case "nodo2":
      json_mask["device"] = req.query.device;
      json_mask["device-location"] = "POINT(45.76 4.86)";
      break;
    case "nodo3":
      json_mask["device"] = req.query.device;
      json_mask["device-location"] = "POINT(45.77 4.87)";
      break;
   } 

  let resultjson = jtr.replace(json_mask, require("../templates/Pilot-5.2-Codan-TempHumCO2_device.json"), "{{", "}}");

  //for each observation
  let querytext;
  let queryvalues;
  if (req.query.from && req.query.to) {
    querytext = "SELECT _id, * FROM doc.et"+req.query.device+" WHERE time_index >= '"+req.query.from+"' and time_index < '"+req.query.to+"'";
    queryvalues = [];
  }
   else {
     querytext = `SELECT _id, * FROM doc.et`+req.query.device+` WHERE entity_id = $1 limit $2`;
     queryvalues = [req.query.device, queryLimit];
   }
   
 
  
pool.query(querytext, queryvalues, (err, result) => {
  if (err) {
    return console.error('Error executing query', err.stack)
  }
  result.rows.forEach(observation => {
    json_mask ["observation"] = "obs-"+observation["_id"];
    json_mask ["timestamp"] = observation["time_index"];
    json_mask ["result-temp"] = observation["temperatura"];
    json_mask ["result-hum"] = observation["humedad"];
    json_mask ["result-co2"] = observation["eco2"];
    json_mask ["result-tvoc"] = observation["tvoc"];

    resultjson["@graph"] = resultjson["@graph"].concat(jtr.replace(json_mask, require("../templates/Pilot-5.2-Codan-TempHumCO2_observation.json"), "{{", "}}")["@graph"]);

       
  });
  

  res.json(resultjson);

})

 //Que hacemos si llegamos aquí y todavía no se ha retornado lo de arriba?

});

router.get('/queryHelloWorld', function(req, res, next) {
  console.log(`Parametros from: ${req.query.from} y to: ${req.query.to}`);

  const text = "SELECT _id, * FROM doc.etnodo1 WHERE time_index >= '"+req.query.from+"' and time_index < '"+req.query.to+"'";
  const values = [];
  //const text = "SELECT _id, * FROM doc.etnodo1 WHERE time_index >= '$1' and time_index < '$2'";
  //const values = [req.query.from, req.query.to];
  
pool.query(text, values, (err, result) => {
  if (err) {
    return console.error('Error executing query', err.stack)
  }
  console.log(result.rows) // brianc

  res.json(result.rows);

})
});


module.exports = router;
