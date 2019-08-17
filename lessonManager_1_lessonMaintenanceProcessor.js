var moduleName = 'lessonMaintenanceProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Module to handle back progsation
* outputs
* when lessons are passed
* etc
*
* Find spherons which have become 'dead' - i.e. having neither inputs nor outputs which can happen as a result of petrification.
*
* Note this module will run as a standalone item rather than as part of a spheron
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
