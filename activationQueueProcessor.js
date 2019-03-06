var moduleName = 'activationQueueProcessor'
var settings = require('./settings.json')

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

	}
}

module.exports = activationQueueProcessor;
