var moduleName = 'activationQueueProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Module to handle activations
*/ 

var activationQueueProcessor = {
	spheron: null,
	logger: null,
	init: function(thisSpheron, logger, callback){
		var that = this
		that.logger = logger
		that.spheron = thisSpheron
		that.logger.log(moduleName, 2,'init')

		callback()

	},
	test: function(callback){
		callback("passed")
	},
	test2: function(callback){
		callback("fish")
	}
}
module.exports = activationQueueProcessor;
