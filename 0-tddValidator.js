var moduleName = 'tddValidator'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Module to test if TDD is performing as expected.
*/ 

var tddValidator = {
	logger: null,
	init: function(logger, callback){
		var that = this
		that.logger = logger;
		that.logger.log(moduleName, 2,'init') 
		callback()
	},
	cbNull: function(callback){
 		callback(null)
	},
	cbString: function(callback){
 		callback("a string")
	},
	cbNumber: function(callback){
 		callback(1)
	},
	cbArrayOfStrings: function(callback){
 		callback(["first","second","third"])
	},
	cbArrayOfNumbers: function(callback){
 		callback([1,2,3])
	},
	cbArrayOfStringArrays: function(callback){
 		//callback(["first","second","third","fourth","fifth","sixth"])
 		//callback([["first","second"],["third","fourth"],["fifth","sixth"]])
 		callback([['first','second'],['third','fourth'],['fifth','sixth']])
	},
	mirror: function(thisParams, callback){
		var that = this
		that.logger.log(moduleName, 2, 'parameters: ' + thisParams)
		callback(thisParams)
	},
	unpackedMirror: function(param1, param2, callback){
		var that = this
		that.logger.log(moduleName, 2, 'parameters: ' + param1 + ', ' + param2)
		callback([param1, param2])
	}
}

module.exports = tddValidator;
