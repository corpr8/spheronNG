const fs = require('fs');
var settings = require('./settings.json')
const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const util = require('util');
var Logger = require('./logger.js')
const mongoUtils = require('./mongoUtils.js')
var logger = new Logger(settings.logOptions)

const port = 3030

app.use(express.static('public'))

app.get('/stuff', function(req, res) {

});

mongoUtils.init(logger, function(){
	app.listen(port);	
})

console.log('Listening on port ' + port + '...');


