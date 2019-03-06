var moduleName = 'propagationQueueProcessor'
var settings = require('./settings.json')

/*
* Module to handle propogating messages from the propagation queue
*/ 

var propagationQueueProcessor = {
	spheron: null,
	logger: null,
	init: function(thisSpheron, logger, callback){
		var that = this
		that.spheron = thisSpheron
		that.logger = logger
		that.logger.log(moduleName, 2,'init')

		callback()

	}
}

module.exports = propagationQueueProcessor;
