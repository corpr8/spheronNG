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
				that.logger.log(moduleName, 2, 'Running Phase 0')
				/*
				* TODO: Call the functions...
				*/
				that.processorPhaseIterator(phaseIdx +1, callback)

			break;
				default:
				/*any post processing and callback*/
				that.logger.log(moduleName, 2, 'Calling back from inputMessageQueueProcessor to main runner')
				callback()
			break;
		}
	},
	iterateQueueVariantsAndExpand: function(callback){
		var that = this
		that.logger.log(moduleName, 2, 'iterateQueueVariantsAndExpand has been called.')
		process.exitCode = 1
	},
	getInputVarients: function(inputName, callback){
		var that = this
		that.getInputVarientIterator(inputName, 0, function(thisResult){
			thisResult.unshift(inputName)
			callback(thisResult)
		})
	},
	getInputVarientIterator: function(inputName, inputIdx, callback){
		var that = this
		if(that.spheron.variants.inputs[inputIdx]){
			if(that.spheron.variants.inputs[inputIdx].original == inputName){
				var results = []
				for(var v=0;v<that.spheron.variants.inputs[inputIdx].variants.length;v++){
					results.push(that.spheron.variants.inputs[inputIdx].variants[v])
				}
				callback(results)
			} else {
				that.getInputVarientIterator(inputName,inputIdx+1, callback)
			}
		} else {
			callback()
		}
		
	}
}
module.exports = activationQueueProcessor;
