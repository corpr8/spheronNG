var moduleName = 'backpropQueueProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');

/*
* Module to handle backprop messages
*/ 

var backpropQueueProcessor = {
	spheron: null,
	logger: null,
	mongoUtils: null,
	commonFunctions: null,
	init: function(thisSpheron, logger, mongoUtils, callback){
		var that = this
		that.logger = logger
		that.spheron = thisSpheron
		that.logger.log(moduleName, 2,'init')
			
		if(!that.spheron.tdd){
			that.mongoUtils = mongoUtils
			that.logger.log(moduleName, 2, 'Module running in Production mode')
			asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
				that.commonFunctions = thisCommonFunctions
				that.commonFunctions.init(that.logger, that.mongoUtils, that.spheron, function(){
					that.processPhases(function(){
						callback(that.spheron)
					})
				})
			})
		} else {  	
			asyncRequire('./mongoUtils').then(function(thisModule){
				that.mongoUtils = thisModule
				that.logger.log(moduleName, 2, 'Module running in TDD mode')  
				that.mongoUtils.init(that.logger, function(){
					that.logger.log(moduleName, 2, 'Mongo Initialised')
					asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
						that.commonFunctions = thisCommonFunctions
						that.commonFunctions.init(that.logger, that.mongoUtils, that.spheron, function(){
							that.spheron.init(that.logger, function(){ //not sure if we need to run init in this mode either?!?!
								that.logger.log(moduleName, 2, 'Spheron initialised')
								callback()
							})
						})
					})
				})
			})
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

				that.logger.log(moduleName, 2, 'Running Phase 0: iterating the backpropQueue')
				that.bpQueueIterator(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				default:
				/*any post processing and callback*/
				that.logger.log(moduleName, 2, 'Calling back from ' + moduleName + ' to main runner')
				callback()
			break;
		}
	},
	bpQueueIterator: function(callback){
		var that = this
		that.logger.log(moduleName, 2, 'running bpQueue iterator')
		if(that.spheron.bpQueue){
			if(that.spheron.bpQueue[0]){
				that.logger.log(moduleName, 2, 'we have a bpQueue item')
				//remove the item from the bpQueue
				var thisItem = that.spheron.bpQueue[0]
				that.processBpQueueItem(thisItem, function(){
					that.spheron.removebpQueueItemByIdx(0, function(){
						that.bpQueueIterator(callback)
					})
				})
			} else{
				callback()
			}
		} else{
			callback()
		}
	},
	processBpQueueItem: function(bpQueueItem, callback){ 
		/*
		* BP QueueItem standard:
		*
		* {"signalPath":"input1;input2;input3;bias1;internal2;","bpSignalDepth":0, "error":0.12635,"lessonId":"whatIsAnd","sigId":"1000","lessonIdx":2}
		*
		* bpSignalDepth is incremented each time we find a match in output, bias or signal until bpSignalDepth is > singalPath.split(';').length
		* This is used to stop infinite back propogation
		*
		* Wherever we find a match with the io.id, we search bpErrors on that io for a match of signalPath and bpSignalDepth.
		*  If we find a match, update it
		*  if no match, create an object:
		*
		* bpErrors: [
		* {
		*	signalPath: "input1;input2;input3;bias1;internal2;",
		*   bpSignalDepth: 0,
		*   errorMap: {
		*     0: 0.12635
		*     1: 1.1111
		*     2: 2.345
		*     3: 2.22
		*   }
		* }
		* ]
		*/
		var that = this
		that.logger.log(moduleName, 2, 'searching outputs')
		that.bpQueueItemContainsOutputIterator(bpQueueItem, 0, function(bpQueueItem){
			that.logger.log(moduleName, 2, 'Depth: ' + bpQueueItem.bpSignalDepth)
			if(bpQueueItem.bpSignalDepth <= bpQueueItem.signalPath.split(';').length){
				that.logger.log(moduleName, 2, 'searching biases')
				that.bpQueueItemContainsBiasIterator(bpQueueItem, 0, function(bpQueueItem){
					that.logger.log(moduleName, 2, 'Depth: ' + bpQueueItem.bpSignalDepth) 
					if(bpQueueItem.bpSignalDepth <= bpQueueItem.signalPath.split(';').length){
						that.logger.log(moduleName, 2, 'searching inputs')
						that.bpQueueItemContainsInputIterator(bpQueueItem, 0, function(){
							callback()
						})
					} else{
						callback()
					}
				})
			} else{
				callback()
			}
		})
	},
	bpQueueItemContainsOutputIterator: function(bpQueueItem, idx, callback){
		/*
		* iterate each io. if type == "output or extOutput"
		* find if it is a substring of the signalPath
		* if so, search the bpErrors objects and either create or update as applicable
		* increment bpSignalDepth and test that it is still less than signalPath.split(';').length
		*/
		var that = this 
		
		if(that.spheron.io[idx]){
			that.logger.log(moduleName, 2, 'running bpQueueItemContainsOutputIterator. idx: ' + idx)
			if(that.spheron.io[idx].type == "output" || that.spheron.io[idx].type == "extOutput"){
				that.logger.log(moduleName, 2, 'type is output.')
				that.logger.log(moduleName, 2, 'id: ' + that.spheron.io[idx].id)

				if(bpQueueItem.signalPath.indexOf(that.spheron.io[idx].id) != -1){
					that.logger.log(moduleName, 2, 'we found an output matching part of the signalPath')
					bpQueueItem.bpSignalDepth += 1

					that.addAmendToErrorMap(bpQueueItem, idx, 0, function(){
						that.logger.log(moduleName, 2, 'new error item created...')
						that.bpQueueItemContainsOutputIterator(bpQueueItem, idx+1 , callback)	
					})
				} else {
					that.logger.log(moduleName, 2, 'outputID is not a substring of the path')
					that.bpQueueItemContainsOutputIterator(bpQueueItem, idx+1 , callback)
				}
			} else {
				that.bpQueueItemContainsOutputIterator(bpQueueItem, idx+1 , callback)
			}
		} else {
			callback(bpQueueItem)
		}
	},
	bpQueueItemContainsBiasIterator: function(bpQueueItem, idx, callback){
		/*
		* iterate each io. if type == "bias"
		* find if it is a substring of the signalPath
		* if so, search the bpErrors objects and either create or update as applicable
		* increment bpSignalDepth and test that it is still less than signalPath.split(';').length
		*/
		var that = this
		if(that.spheron.io[idx]){
			that.logger.log(moduleName, 2, 'running bpQueueItemContainsBiasIterator. idx: ' + idx)
			if(that.spheron.io[idx].type == "bias"){
				if(bpQueueItem.signalPath.indexOf(that.spheron.io[idx].id) != -1){
					that.logger.log(moduleName, 2, 'we found a bias matching part of the signalPath')
					bpQueueItem.bpSignalDepth += 1
					that.addAmendToErrorMap(bpQueueItem, idx, 0, function(){
						that.logger.log(moduleName, 2, 'new error item created...')
						that.bpQueueItemContainsBiasIterator(bpQueueItem, idx+1 , callback)	
					})

				} else {
					that.bpQueueItemContainsBiasIterator(bpQueueItem, idx+1 , callback)
				}
			} else {
				that.bpQueueItemContainsBiasIterator(bpQueueItem, idx+1 , callback)
			}
		} else {
			callback(bpQueueItem)
		}
	},
	bpQueueItemContainsInputIterator: function(bpQueueItem, idx, callback){
		/*
		* iterate each io. if type == "input or extInput"
		* find if it is a substring of the signalPath
		* if so, search the bpErrors objects and either create or update as applicable
		* increment bpSignalDepth and test that it is still less than signalPath.split(';').length
		* copy the error object to the upstream spheron
		*/
		var that = this
		if(that.spheron.io[idx]){
			that.logger.log(moduleName, 2, 'running bpQueueItemContainsInputIterator. idx: ' + idx)
			if(that.spheron.io[idx].type == "input" || that.spheron.io[idx].type == "extInput"){
				if(bpQueueItem.signalPath.indexOf(that.spheron.io[idx].id) != -1){
					that.logger.log(moduleName, 2, 'we found an input matching part of the signalPath')
					bpQueueItem.bpSignalDepth += 1
					that.addAmendToErrorMap(bpQueueItem, idx, 0, function(){
						that.logger.log(moduleName, 2, 'new error item created...')
						/*
						* TODO: Propagate upstream from here using the current bpQueueItem...
						*/
						if(that.spheron.io[idx].type == "input"){
							that.pushToUpstreamSpheronBPQueue(that.spheron.io[idx].fromId, bpQueueItem, function(){
								that.bpQueueItemContainsInputIterator(bpQueueItem, idx+1 , callback)
							})
						} else {
							that.bpQueueItemContainsInputIterator(bpQueueItem, idx+1 , callback)
						}
					})
				} else {
					that.bpQueueItemContainsInputIterator(bpQueueItem, idx+1 , callback)
				}
			} else {
				that.bpQueueItemContainsInputIterator(bpQueueItem, idx+1 , callback)
			}
		} else {
			callback(bpQueueItem)
		}
	},
	addAmendToErrorMap: function(bpErrorMessage, ioIdx, errorMapIdx, callback){
		//iteratate each errorMapObject at this io
		//if we have a match of signalPath and signalDepth
		//update the existent object
		//otherwise add a new errormapObject
		var that = this
		if(that.spheron.io[ioIdx].errorMap[errorMapIdx]){
			if(that.spheron.io[ioIdx].errorMap[errorMapIdx].signalPath == bpErrorMessage.signalPath && that.spheron.io[ioIdx].errorMap[errorMapIdx].bpSignalDepth == bpErrorMessage.bpSignalDepth){
				that.spheron.io[ioIdx].errorMap[errorMapIdx].errorMap[bpErrorMessage.lessonIdx] = bpErrorMessage.error
				that.logger.log(moduleName, 2, 'setting error map item: ' + JSON.stringify(that.spheron.io[ioIdx].errorMap[errorMapIdx].errorMap[bpErrorMessage.lessonIdx]))
				callback()
			} else {
				that.addAmendToErrorMap(bpErrorMessage, ioIdx, errorMapIdx+1, callback)
			}
		} else {
			//we didnt find it so create a new one.
			var errorMapItem = {
				"signalPath": bpErrorMessage.signalPath,
				"bpSignalDepth": bpErrorMessage.bpSignalDepth,
				"errorMap" : {}
			}
			errorMapItem.errorMap[bpErrorMessage.lessonIdx] = bpErrorMessage.error
			that.logger.log(moduleName, 2, 'Pushing new errormap item: ' + JSON.stringify(errorMapItem))

			that.spheron.io[ioIdx].errorMap.push(errorMapItem)
			callback()
		}
	},
	pushToUpstreamSpheronBPQueue: function(spheronId, bpErrorMessage, callback){
		var that = this
		if(bpErrorMessage.bpSignalDepth <= bpErrorMessage.signalPath.split(';').length){
			//TODO:


			/*
			* use mongo library to push to a spherons bpMessageQueue
			*/ 
			that.mongoUtils.pushToUpstreamSpheronBPQueueBySpheronId(spheronId, bpErrorMessage, function(){
				callback()
			})
		} else {
			that.logger.log(moduleName, 2, 'Signal too deep. Not backproping...')
			callback()
		}
	},
	getSpheronIO: function(callback){
		var that = this
		that.logger.log(moduleName, 2, 'spheron IO is: ' + JSON.stringify(that.spheron.io))
		callback(that.spheron.io)
	},
	getBpQueue: function(callback){
		var that = this
		that.logger.log(moduleName, 2, 'spheron bpQueue is: ' + JSON.stringify(that.spheron.bpQueue))
		callback(that.spheron.bpQueue)
	}
}

module.exports = backpropQueueProcessor;
