var moduleName = 'activationQueueProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var multivariator = require(appDir +'/multivariator.js')
var asyncRequire = require('async-require');

/*
* Module to handle activations
*/ 

var activationQueueProcessor = {
	spheron: null,
	logger: null,
	commonFunctions: null,
	mongoUtils: null,
	init: function(thisSpheron, logger, callback){
		var that = this
		that.logger = logger
		that.spheron = thisSpheron
		that.logger.log(moduleName, 2,'init')
		
		multivariator.init(that.logger, function(){	
			if(!that.spheron.tdd){
				asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
					that.commonFunctions = thisCommonFunctions
					that.commonFunctions.init(that.logger, that.mongoUtils, that.spheron, function(){
						that.logger.log(moduleName, 2, 'Module running in Production mode')
						that.processPhases(function(){
							callback(that.spheron)
						}) 
					})
				})
			} else {
				that.spheron.init(that.logger, function(){  //is this really needed???
					asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
						that.commonFunctions = thisCommonFunctions
						that.commonFunctions.init(that.logger, that.mongoUtils, that.spheron, function(){
							that.logger.log(moduleName, 2, 'Module running in TDD mode')
					 		callback() 
					 	})
					})
				}) 
			}	
		})
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
				that.logger.log(moduleName, 2, 'Running Phase 0 - expanding out signals in the activationQueue')
				that.hasVariants(function(hasVariants){
					if(hasVariants){
						//iterate the input queue and see if items need to be variated.
						that.variateActivationQueue(function(){
							that.processorPhaseIterator(phaseIdx +1, callback)
						})
					} else {
						//no variation work to do so lets go to the next phase...
						that.processorPhaseIterator(phaseIdx +1, callback)
					}
				})
			break;
			case 1:
				that.logger.log(moduleName, 2, 'Running Phase 1 - activating the spheron and pushing to propagationQueue')
				that.iterateActivationQueueAndActivate(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				default:
				/*any post processing and callback*/
				that.logger.log(moduleName, 2, 'Calling back from activationQueueProcessor to main runner')
				callback()
			break;
		}
	},
	hasVariants:function(callback){
		var that = this
		if(that.spheron.variants.inputs.length > 0){
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
			for(var v=0;v<result.length;v++){
				that.logger.log(moduleName, 2, 'input variant array is[' + v + ']: ' + result[v].join(','))	
			}
			callback(result)
		})
	},
	getInputVariantArrayIterator: function(idx, variantItemIdx, resultantArray, callback){
		var that = this
		if(that.spheron.variants.inputs[idx]){
			if(variantItemIdx == 0){
				that.logger.log(moduleName, 4, 'pushing to resultantArray. ')

				/*
				* 5/10/19
				* note: changed the functioning of the belwo such that variantarrray isper experiment.
				* before it was just resultantArray.push([that.spheron.variants.inputs[idx].original])
				* with no preceeding test
				*/
				if(!resultantArray[idx]){resultantArray[idx] = []}
				resultantArray[idx].push(that.spheron.variants.inputs[idx].original)
			}

			if(that.spheron.variants.inputs[idx].variants[variantItemIdx]){
				that.logger.log(moduleName, 4, 'resultantArray: ' + resultantArray)
				that.logger.log(moduleName, 4, 'resultantArray length: ' + resultantArray.length)
				resultantArray[idx].push(that.spheron.variants.inputs[idx].variants[variantItemIdx])
				that.getInputVariantArrayIterator(idx, variantItemIdx+1, resultantArray, callback)
			} else {
				that.getInputVariantArrayIterator(idx+1, 0,resultantArray, callback)
			}
		} else {
			callback(resultantArray)
		}
	},
	variateActivationQueue:function(callback){
		var that = this
		that.getInputVariantArray(function(inputVariantArray){
			multivariator.multivariate(inputVariantArray, function(variatedArray){
				for(var v=0;v<variatedArray.length;v++){
					that.logger.log(moduleName, 4, 'Input Variant variatedArray[' + v + ']: ' + variatedArray[v])	
				}
				that.iterateVariatingActivationQueueIterator(variatedArray, 0, function(){
					callback()	
				})		
			})
			
		})
	},
	iterateVariatingActivationQueueIterator:function(inputVariantArray, idx, callback){
		var that = this
		if(that.spheron.activationQueue[idx]){
			that.isVariated(idx, function(isVariated){
				if(isVariated){
					that.iterateVariatingActivationQueueIterator(inputVariantArray, idx+1, callback)
				} else {
					/* 1: make a copy of this signal*/
					var originalSignal = JSON.parse(JSON.stringify(that.spheron.activationQueue[idx]))
					originalSignal.variated = true

					/* 2: remove this signal from the queue */
					that.spheron.removeItemFromActivationQueueByIdx(idx, function(){ 
						/* 3: get all permutations
						* 4: for each permutation, make a copy and remove the non included variants
						* 5: push each permutation onto the variant queue
						*/
						that.buildVariants(inputVariantArray, originalSignal, function(){
							//7: eventually iterate but without incrementing the counter as we have deleted this idx.
							that.iterateVariatingActivationQueueIterator(inputVariantArray, idx, callback)	
						})
						
					})
				}
			})
		} else {
			callback()
		}
	},
	findIfInputIsvariated: function(inputId, callback){
		var that = this
		that.findIfInputIsVariatedIterator(inputId, 0, -1, function(result){
			callback(result)
		})	
	},
	findIfInputIsVariatedIterator: function(inputId, variantIdx, variantItemIdx, callback){
		var that = this
		if(that.spheron.variants.inputs[variantIdx]){
			if(variantItemIdx == -1){
				if(inputId == that.spheron.variants.inputs[variantIdx].original){
					callback(true)
				} else {
					that.findIfInputIsVariatedIterator(inputId, variantIdx, variantItemIdx +1, callback)
				}
			} else if(that.spheron.variants.inputs[variantIdx].variants[variantItemIdx]){
				//iterate through each item then iterate the variatnIdx
				if(inputId == that.spheron.variants.inputs[variantIdx].variants[variantItemIdx]){
					callback(true)
				} else {
					that.findIfInputIsVariatedIterator(inputId, variantIdx, variantItemIdx +1, callback)	
				}
			} else { 
				that.findIfInputIsVariatedIterator(inputId, variantIdx+1, -1, callback)
			}
		} else {
			callback(false)
		}
	},
	buildVariants: function(inputVariantArray, originalSignal, callback){
		//Todo:
		//Iterate each member of the variantArray
		//If it can be built from the data in this activtionQueueItem then do so
		var that = this
		that.buildVariantsIterator(inputVariantArray, originalSignal, 0, function(){
			callback()
		})
	},
	buildVariantsIterator: function(inputVariantArray, originalSignal, variantIdx, callback){
		//Todo:
		//Iterate each member of the variantArray
		//If it can be built from the data in this activtionQueueItem then do so
		var that = this
		that.logger.log(moduleName, 4, 'ok we are iterating in the buildVariantsIterator: ')
		that.logger.log(moduleName, 4, 'inputVariantArray[variantIdx] is: ' + inputVariantArray[variantIdx])
		that.logger.log(moduleName, 4, 'originalSignal is: ' + JSON.stringify(originalSignal))

		// for each part of original signal,
		if(inputVariantArray[variantIdx]){
			that.buildVariantItem(inputVariantArray[variantIdx], 0, originalSignal, null, function(resultantSignal){
				that.spheron.pushSignalToActivationQueue(resultantSignal, function(){
					that.buildVariantsIterator(inputVariantArray, originalSignal, variantIdx+1 , callback)
				})
			})
		} else {
			//all done 
			callback()
		}
	},
	buildVariantItem: function(inclusionArray, originalSignalIoIdx, originalSignal, resultantSignal, callback){
		var that = this

		that.logger.log(moduleName, 2, 'running build variant items. Activation queue is: ' + JSON.stringify(that.spheron.activationQueue))
		resultantSignal = (resultantSignal) ? resultantSignal : {
			"signalId" :originalSignal.signalId,
			"io":[], 
			"variated": true
		}

		if(originalSignal.io[originalSignalIoIdx]){
			// is the input variated? If not, push it straight onto the output.
			// if it is variated, is it part of the inclusion array? If so, push it onto the output
			that.findIfInputIsvariated(originalSignal.io[originalSignalIoIdx].input, function(isVariated){
				if(!isVariated){
					resultantSignal.io.push(originalSignal.io[originalSignalIoIdx])
					that.buildVariantItem(inclusionArray, originalSignalIoIdx+1, originalSignal, resultantSignal, callback)
				}else {
					if(inclusionArray.indexOf(originalSignal.io[originalSignalIoIdx].input) != -1){
						resultantSignal.io.push(originalSignal.io[originalSignalIoIdx])
					} else {

						that.logger.log(moduleName, 2, 'we are excluding the signal: ' + JSON.stringify(originalSignal.io[originalSignalIoIdx]))
						that.logger.log(moduleName, 2, 'inclusion array was: ' + inclusionArray.join(','))
						that.logger.log(moduleName, 2, 'original signal input was: ' +originalSignal.io[originalSignalIoIdx].input )
						var editedSignal = JSON.parse(JSON.stringify(originalSignal.io[originalSignalIoIdx]))
						editedSignal.val = "excluded"
						editedSignal.path = "excluded"
						that.logger.log(moduleName, 2, 'we have converted it to: ' + JSON.stringify(editedSignal))
						resultantSignal.io.push(editedSignal)

					}
					that.buildVariantItem(inclusionArray, originalSignalIoIdx+1, originalSignal, resultantSignal, callback)
				}
			})
		}else {
			callback(resultantSignal)
		}
	},
	getActivationQueue: function(callback){
		var that = this
		that.spheron.getActivationQueue(function(activationQueue){
			that.logger.log(moduleName, 4, 'activationQueue: ' + JSON.stringify(activationQueue))
			callback(activationQueue)
		})
	},
	iterateActivationQueueAndActivate: function(callback){
		var that = this
		that.iterateActivationQueueAndActivateIterator(function(){
			that.logger.log(moduleName, 2,'finished processing the activation queue. ')
			callback()
		})
	},
	iterateActivationQueueAndActivateIterator: function(callback){
		var that = this
		if(that.spheron.activationQueue[0]){
			that.spheron.activate(that.spheron.activationQueue[0], function(){
				that.spheron.removeItemFromActivationQueueByIdx(0, function(){
					that.iterateActivationQueueAndActivateIterator(callback)
				})
			})
		} else {
			//done iterating
			callback()
		}
	}/*,
	getPropogationMessageQueue: function(callback){
		var that = this
		that.spheron.getPropagationMessageQueue(function(propagationMessageQueue){
			that.logger.log(moduleName, 2, 'propagationMessageQueue is: ' + JSON.stringify(propagationMessageQueue))
			callback(propagationMessageQueue)
		})
	}*/
}
module.exports = activationQueueProcessor;
