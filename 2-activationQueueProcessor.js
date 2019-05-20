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
	hasVariants:function(callback){
		var that = this
		if(that.spheron.variatns.inputs.length > 0){
			callback(true)
		} else {
			callback(false)
		}

	},
	isVariated: function(idx, callback){
		var that = this
		if(that.spheron.activationQueue[idx].variated){
			callback(true)
		}else{ 
			callback(false)
		}
	},
	getInputVariantArray: function(callback){
		var that = this
		that.getInputVariantArrayIterator(0, 0, [], function(result){
			callback(result)
		})
	},
	getInputVariantArrayIterator: function(idx, variantItemIdx, resultantArray, callback){
		var that = this
		if(that.spheron.variants.inputs[idx]){
			if(variantItemIdx == 0){
				that.logger.log(moduleName, 2, 'pushing to resultantArray. ')
				resultantArray.push([that.spheron.variants.inputs[idx].original])
			}

			if(that.spheron.variants.inputs[idx].variants[variantItemIdx]){
				that.logger.log(moduleName, 2, 'resultantArray: ' + resultantArray)
				that.logger.log(moduleName, 2, 'resultantArray length: ' + resultantArray.length)
				resultantArray[idx].push(that.spheron.variants.inputs[idx].variants[variantItemIdx])
				that.getInputVariantArrayIterator(idx, variantItemIdx+1, resultantArray, callback)
			} else {
				that.getInputVariantArrayIterator(idx+1, 0,resultantArray, callback)
			}
		} else {
			callback(resultantArray)
		}
	},
	iterateActivationQueue:function(callback){
		var that = this
		that.iterateActivationQueueIterator(0, function(){
			callback()	
		})
	},
	iterateActivationQueueIterator:function(idx, callback){
		var that = this
		if(that.spheron.activationQueue[idx]){
			that.isVariated(idx, function(isVariated){
				if(isVariated){
					that.iterateActivationQueueIterator(idx+1, callback)
				} else {
					that.spheron.activationQueue[idx].variated = true
					
					//do work on variating this signal
					/*
					* TODO:
					*/

					process.exitCode = 1
				}
			})
		} else {
			callback()
		}
	}
}
module.exports = activationQueueProcessor;
