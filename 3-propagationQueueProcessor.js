var moduleName = 'propagationQueueProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');

/*
* Module to handle propogating messages from the propagation queue
*/ 

var propagationQueueProcessor = {
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

				/*
				* TODO: We must handle multi-variated of each case.
				* Initially, if we get a signal on a variated input, we should copy that to the others in the test.
				* Eventually - if we have a multivariated output, we should have a way of handling it somehow.
				* Problem being that we will have multiple singnals with the same value going into the same queue - which will wipe out the variations due to queue handling. 
				* Eventually we must modify queue handling to cope - i.e. if a signal comes through which is multi-variant, it fires as an OR with other singals in the queue of its sigId.
				*/

				/*handle straight out single signal matches in the input queue */
				that.logger.log(moduleName, 2, 'Running Phase 0: iterating the propogationQueue')
				that.iteratePropagationQueue(0, function(){
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
	iteratePropagationQueue: function(foundExternalCount, callback){
		var that = this 
		if(that.spheron.propagationMessageQueue.length > foundExternalCount){ 
			//Handle iterating to other 
			that.logger.log(moduleName, 2, 'queue item is: ' + JSON.stringify(that.spheron.propagationMessageQueue[0]))
			that.transformPropagationToInputMessages(that.spheron.propagationMessageQueue[0], function(resultantMessages){
				that.iterateSignalsWithinAPropagationQueueItem(resultantMessages, 0, false, function(hadExternalSignal){
					if(!hadExternalSignal){
						that.spheron.removeItemFromPropagationQueueByIdx(0, function(){
							that.iteratePropagationQueue(foundExternalCount, callback)
						})	
					} else {
						foundExternalCount += 1
						that.iteratePropagationQueue(foundExternalCount, callback)
					}
				})
			})
		} else {
			//all done
			callback()
		}
	},
	transformPropagationToInputMessages: function(inputMessage, callback){ 
		var that = this
		that.logger.log(moduleName, 2, 'running: transformPropagationToInputMessages')
		that.transformPropagationToInputMessagesIterator(inputMessage, 0, [], function(resultantMessages){
			callback(resultantMessages)
		})
	},
	transformPropagationToInputMessagesIterator: function(inputMessage, idx, resultantMessages, callback){
		var that = this
		if(inputMessage.io){
			if(inputMessage.io[idx]){
				var thisMessage = JSON.parse(JSON.stringify(inputMessage.io[idx]))
				thisMessage.lessonId = inputMessage.lessonId
				thisMessage.sigId = inputMessage.signalId
				thisMessage.lessonIdx = inputMessage.lessonIdx
				resultantMessages.push(thisMessage)  
				that.transformPropagationToInputMessagesIterator(inputMessage, idx +1, resultantMessages, callback)
			} else {
				callback(resultantMessages)
			}
		} else { 
			callback(null)
		}
	},
	iterateSignalsWithinAPropagationQueueItem: function(propagationQueueItemMessagesAsInputArray, idx, hadExternalSignal, callback){
		var that = this
		hadExternalSignal = (hadExternalSignal) ? hadExternalSignal : hadExternalSignal
		if(propagationQueueItemMessagesAsInputArray){
			if(propagationQueueItemMessagesAsInputArray[idx]){
				that.getLastPortFromPath(propagationQueueItemMessagesAsInputArray[idx].signalPath, function(thisIoPort){
					that.logger.log(moduleName, 2, 'last port is: ' + thisIoPort)
					/*
					* WE need to check if this is to ext and set the lesson to pending if it is...
					* {"toId":"outputSpheron1","toPort":"internal1"}
					*
					* TODO: Write tests to support this usecase...
					*/
					//that.getSpheronPortTypeFromPort(thisIoPort, function(spheronPortType){
						that.logger.log(moduleName, 2, 'message port type is: ' + propagationQueueItemMessagesAsInputArray[idx].type)
						if(propagationQueueItemMessagesAsInputArray[idx].type == "extOutput"){
							hadExternalSignal = true
							that.mongoUtils.setLessonAsPending(propagationQueueItemMessagesAsInputArray[idx].lessonId, function(){
								that.logger.log(moduleName, 2, 'we have a message for an extOutput so we have set the lesson as pending:' + propagationQueueItemMessagesAsInputArray[idx].lessonId)
								that.iterateSignalsWithinAPropagationQueueItem(propagationQueueItemMessagesAsInputArray, idx+1, hadExternalSignal, callback)
							})
						} else {
							that.getToSpheronIdAndPortFromPort(thisIoPort, function(thisDestinationSpheronAndInputPort){
								that.logger.log(moduleName, 2, 'to id and port is: ' + JSON.stringify(thisDestinationSpheronAndInputPort))
								that.pushMessageToInputQueueBySpheronIdAndPort(thisDestinationSpheronAndInputPort, propagationQueueItemMessagesAsInputArray[idx], function(){
									that.logger.log(moduleName, 2, 'finished pushing message to inputqueue - iterating to next part of message...')
									that.iterateSignalsWithinAPropagationQueueItem(propagationQueueItemMessagesAsInputArray, idx+1, hadExternalSignal, callback)
								})
							})
						}
					})
				//})
			} else {
				callback(hadExternalSignal)
			}
		} else {
			callback(hadExternalSignal)
		}
	},  
	pushMessageToInputQueueBySpheronIdAndPort: function(spheronIdAndPort, thisMessage, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running pushMessageToInputQueueBySpheronIdAndPort')
		that.mongoUtils.pushMessageToInputQueueBySpheronIdAndPort(spheronIdAndPort, thisMessage, function(){
			that.logger.log(moduleName, 2, 'called back from mongoutils')
			callback()
		}) 
	}, 
	getLastPortFromPath: function(thisPath, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running getLastPortFromPath')
		that.logger.log(moduleName, 2, 'thisPath: ' + thisPath)
		var pathElements = thisPath.split(';')
		if(pathElements.length == 0){
			that.logger.log(moduleName, 2, 'returning: null')
			callback(null)
		} else if(pathElements.length == 1){
			that.logger.log(moduleName, 2, 'returning: ' + pathElements[0])
			callback(pathElements[0])
		} else {
			that.logger.log(moduleName, 2, 'returning: ' + pathElements[pathElements.length -2])
			callback(pathElements[pathElements.length -2])
		}
	},
	getToSpheronIdAndPortFromPort: function(portId, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running getToSpheronIdAndPortFromPort')
		that.spheron.getToSpheronIdAndPortFromPortIterator(portId, 0, function(thisResult){
			callback(thisResult)
		})
	},
	getSpheronPortTypeFromPort: function(portId, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running getToSpheronIdAndPortFromPort')
		that.spheron.getspheronPortTypeIterator(portId, 0, function(thisResult){
			callback(thisResult)
		})	
	}
}

module.exports = propagationQueueProcessor;
