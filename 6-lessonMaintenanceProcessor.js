var moduleName = 'lessonMaintenanceProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Module to handle propogating messages from the propagation queue
*/ 

var lessonMaintenanceProcessor = {
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
module.exports = lessonMaintenanceProcessor;
