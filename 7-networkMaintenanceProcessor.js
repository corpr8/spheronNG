var moduleName = 'networkMaintenanceProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Network mainenance.
* If the life of a connection within a spheron has fallen below the static threshold,
* Turn it into a bias (combine it with the existant biases?)
* also remove any connections too the now bias.
*/ 

var networkMaintenanceProcessor = {
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
module.exports = networkMaintenanceProcessor;
