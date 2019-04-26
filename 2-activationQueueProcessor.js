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
			
		if(!that.spheron.tdd){
			that.logger.log(moduleName, 2, 'Module running in Production mode')
			that.processPhases(function(){
				callback(that.spheron)
			}) 
		} else {
			that.logger.log(moduleName, 2, 'Module running in TDD mode')
			callback() 
		}
	},
	processPhases: function(callback){
 		var that = this
 		that.processorPhaseIterator(0, function(){
 			callback()
 		})
	},
	processorPhaseIterator: function(phaseIdx, callback){
		var that = this
		switch(phaseIdx){
			case 0:
				//Handle full signal matches
				/*handle straight out single signal matches in the input queue */
				that.logger.log(moduleName, 2, 'Running Phase 0')

					that.processorPhaseIterator(phaseIdx +1, callback)

			break;
				default:
				/*any post processing and callback*/
				that.logger.log(moduleName, 2, 'Calling back from inputMessageQueueProcessor to main runner')
				callback()
			break;
		}
	},

	test: function(callback){
		callback("passed")
	},
	test2: function(callback){
		callback("fish")
	}
}
module.exports = activationQueueProcessor;
