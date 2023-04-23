var express = require('express');
const axios = require('axios');

var router = express.Router();
const Jtr = require("@ptkdev/json-token-replace");
const jtr = new Jtr();
require('log-timestamp');
const { Pool } = require('pg');
const { json } = require('express');
const pool = new Pool({ connectionString: 'postgresql://crate@localhost:5432/doc' })

var queryLimit = 20; //We stablish this limit in the number of observations to return, to ease server's load

const host = 'localhost';
const port = 80;


const GET_PROCESO_PESO = `http://${host}:${port}/backend/src/Server.php?request=getProcesosPeso`;
const GET_PROCESO_PESO_BY_ID = `http://${host}:${port}/backend/src/Server.php?request=getProcesosPesoById&id=`;
const GET_TOLERANCIAS_BY_ID = `http://${host}:${port}/backend/src/Server.php?request=getToleranciasById&id=`
const GET_PROCESO_INCIDENCIAS = `http://${host}:${port}/backend/src/Server.php?request=getProcesosIncidencia`;
const GET_PROCESO_INCIDENCIAS_BY_ID = `http://${host}:${port}/backend/src/Server.php?request=getProcesosIncidenciaById&id=`;






const asyncHandler = (fun) => (req, res, next) => {
  Promise.resolve(fun(req, res, next))
    .catch(next)
}


/* GET home page. */
router.get('/aim/v1/getdevicedata', function (req, res, next) {
  console.log(`New getdevicedata request. Device: ${req.query.device} From: ${req.query.from} To: ${req.query.to} Limit: ${req.query.limit} `);
  if (!req.query.device) return res.json({ Error: "device parameter is required, try with nodo1" });

  if (req.query.limit && parseInt(req.query.limit) < queryLimit) queryLimit = parseInt(req.query.limit);

  let json_mask = {};

  //If device exists 
  switch (req.query.device) {
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
    querytext = "SELECT _id, * FROM doc.et" + req.query.device + " WHERE time_index >= '" + req.query.from + "' and time_index < '" + req.query.to + "'";
    queryvalues = [];
  }
  else {
    querytext = `SELECT _id, * FROM doc.et` + req.query.device + ` WHERE entity_id = $1 limit $2`;
    queryvalues = [req.query.device, queryLimit];
  }



  pool.query(querytext, queryvalues, (err, result) => {
    if (err) {
      return console.error('Error executing query', err.stack)
    }
    result.rows.forEach(observation => {
      json_mask["observation"] = "obs-" + observation["_id"];
      json_mask["timestamp"] = observation["time_index"];
      json_mask["result-temp"] = observation["temperatura"];
      json_mask["result-hum"] = observation["humedad"];
      json_mask["result-co2"] = observation["eco2"];
      json_mask["result-tvoc"] = observation["tvoc"];

      resultjson["@graph"] = resultjson["@graph"].concat(jtr.replace(json_mask, require("../templates/Pilot-5.2-Codan-TempHumCO2_observation.json"), "{{", "}}")["@graph"]);


    });


    res.json(resultjson);

  })

  //Que hacemos si llegamos aquí y todavía no se ha retornado lo de arriba?

});


/* GET home page. */
router.get('/aim/v1/getprocesosJSON', asyncHandler(async (req, res) => {

  if (req.query.id) {
    console.log(`New getProcesosJSON invocation with id: ${req.query.id}`);
    var resultjson = { "weight_process": await convertirPesosAJson(req.query.id), "notification_process": await convertirIncidenciasAJson(req.query.id) };

  } else {
    console.log(`New getProcesosJSON invocation without id`);
    var resultjson = { "weight_process": await convertirPesosAJson(), "notification_process": await convertirIncidenciasAJson() };

  }

  res.json(resultjson);
}));

/* GET home page. */
router.get('/aim/v1/getprocesosAIM', asyncHandler(async (req, res) => {

  if (req.query.id) {
    console.log(`New getprocesosAIM invocation with id: ${req.query.id}`);
    var notification_process = await convertirIncidenciasAJson(req.query.id);
    //console.log(notification_process);
    var weight_process = await convertirPesosAJson(req.query.id);
    //console.log (weight_process);

  } else {
    console.log(`New getprocesosAIM invocation without id`);
    var resultjson = { "weight_process": await convertirPesosAJson(), "notification_process": await convertirIncidenciasAJson() };
    var notification_process = await convertirIncidenciasAJson();
    //console.log(notification_process);
    var weight_process = await convertirPesosAJson();
    //console.log (weight_process);

  }

  var result = {};
  result["@context"] = ["https://w3id.org/demeter/agri-context.jsonld",
  "https://w3id.org/demeter/agri/agriAlert-context.jsonld"]

  result["@graph"] = [];
  for (var processid in notification_process) {
    for (const notification of notification_process[processid]) {

      console.log(notification);

      var notification_result = {};
      notification_result['@id'] = "urn:upm:demeter:p52:proccessId:" + notification.id;
      notification_result['@type'] = "Alert";
      notification_result['description'] = notification.description;
      notification_result['validFrom'] = notification.stop_time;
      notification_result['validTo'] = notification.restart_time;
      notification_result['dateIssued'] = notification.restart_time;

      result["@graph"].push(notification_result);
    }
  }

  for (var processid in weight_process) {
    weight = weight_process[processid]

    var weight_result = {};
    weight_result['@id'] = "urn:upm:demeter:p52:proccessId:" + processid;
    weight_result['@type'] = "Weight-process";
    weight_result['supervisor'] = weight.supervisor;
    weight_result['line'] = weight.line;
    weight_result['product'] = weight.product;
    weight_result['real_weight_kg'] = weight.real_weight_kg;
    weight_result['theoretical_weight_kg'] = weight.theoretical_weight_kg;
    weight_result['number_buckets'] = weight.number_buckets;
    weight_result['number_units'] = weight.number_units;
    weight_result['target_weight'] = weight.target_weight;
    weight_result['bucket_weight'] = weight.bucket_weight;
    weight_result['coil_weight'] = weight.coil_weight;
    weight_result['coil_total_weight'] = weight.coil_total_weight;
    weight_result['coil_bucket_weight'] = weight.coil_bucket_weight;
    weight_result['underweight_margin'] = weight.underweight_margin;
    weight_result['overweight_margin'] = weight.overweight_margin;
    weight_result['tolerance_1'] = weight.tolerance_1;
    weight_result['tolerance_2'] = weight.tolerance_2;
    weight_result['tolerance_3'] = weight.tolerance_3;
    weight_result['tolerance_4'] = weight.tolerance_4;
    weight_result['tolerance_5'] = weight.tolerance_5;
    weight_result['tolerance_6'] = weight.tolerance_6;
    weight_result['tolerance_7'] = weight.tolerance_7;

    result["@graph"].push(weight_result);

  }

  //var resultjson = {"weight_process": await convertirPesosAJson(),  "notification_process": await convertirIncidenciasAJson() }; 
  res.json(result);

}));

async function sendGetRequest(url) {

  let res = await axios.get(url).catch(function (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser 
      // and an instance of http.ClientRequest in node.js
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error', error.message);
    }
   
  });

  let data = res.data;
  //console.log(data);
  return data;
}


async function convertirIncidenciasAJson(processId) {
  var result = {};
  var map = new Map();
  var incidencias;
  if (processId) {
    incidencias = (await sendGetRequest(GET_PROCESO_INCIDENCIAS_BY_ID + processId))
  } else {
    incidencias = (await sendGetRequest(GET_PROCESO_INCIDENCIAS))
  }

  incidencias = incidencias["data"];

  incidencias.forEach(element => {
    var nuevo = {
      id: element.id_personalizado,
      description: element.descripcion,
      stop_time: element.horaParada,
      restart_time: element.horaParada
    };

    if (!map.has(element.id_personalizado))
      map.set(element.id_personalizado, []);

    map.get(element.id_personalizado).push(nuevo);
  });

  result = Object.fromEntries(map);
  //console.log(JSON.stringify(result));

  return result;
}

async function convertirPesosAJson(processId) {
  var result = {};
  var pesos;
  if (processId) {
    pesos = await sendGetRequest(GET_PROCESO_PESO_BY_ID + processId);
  } else {
    pesos = await sendGetRequest(GET_PROCESO_PESO);
  }
  console.log(pesos);
  pesos = pesos["data"];
  var incidencias = await sendGetRequest(GET_PROCESO_PESO);
  incidencias = incidencias["data"];

  for (const element of pesos) {
    var tolerancias = await sendGetRequest(GET_TOLERANCIAS_BY_ID + element.id_tolerancias);
    tolerancias = tolerancias["data"][0];

    var datos = {
      supervisor: element.jefe,
      line: element.linea,
      product: element.producto,
      real_weight_kg: element.kilos_reales,
      theoretical_weight_kg: element.kilos_teoricos,
      number_buckets: element.numero_cubetas,
      number_units: element.numero_unidades,
      target_weight: element.peso_objetivo,
      bucket_weight: element.peso_cubetas,
      coil_weight: element.peso_bobinas,
      coil_total_weight: element.peso_total_bobina,
      coil_bucket_weight: element.peso_bobina_cubetas,
      underweight_margin: element.margen_subpeso,
      overweight_margin: element.margen_sobrepeso,
      tolerance_1: tolerancias.tolerancia_1,
      tolerance_2: tolerancias.tolerancia_2,
      tolerance_3: tolerancias.tolerancia_3,
      tolerance_4: tolerancias.tolerancia_4,
      tolerance_5: tolerancias.tolerancia_5,
      tolerance_6: tolerancias.tolerancia_6,
      tolerance_7: tolerancias.tolerancia_7
    };

    result[element.id_personalizado] = datos;

  }
  //console.log(JSON.stringify(result).replaceAll(" ", "_"));

  return result;
}

module.exports = router;
