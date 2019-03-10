var moduleName = 'mutator'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Module to mutate a spheron
*/ 

var mutator = {
	spheron: null,
	logger: null,
	init: function(thisSpheron, logger, callback){
		var that = this
		that.spheron = thisSpheron
		that.logger = logger
		that.logger.log(moduleName, 2,'init')

		if(settings.phaseSettings.disableMutation == true){
			callback()
		} else {
			//ok we should do the mutations...

		}
	}
}

module.exports = mutator;
