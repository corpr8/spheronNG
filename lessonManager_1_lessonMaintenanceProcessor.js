var moduleName = 'lessonMaintenanceProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');
var Logger = null

/*
* Module to handle back propagation
* outputs
* when lessons are passed
* etc
*
* Find spherons which have become 'dead' - i.e. having no inputs. This can happen as a result of petrification.
* Or when the last time a spheron ticked is way behind the rest of the network...
* If a spheron has no outputs
* If the last fedback tick of a spheron is way behind the tick - then it isn't in the signal path...
*
* Note this module will run as a standalone item rather than as part of a spheron
*/ 

var lessonMaintenanceProcessor = {
	logger: null, 
	mongoUtils: null,
	commonFunctions: null,
	lesson: null,
	isRunning: false,
	runTimer: null,
	init: function(mode, logger, mongoUtils, callback){
		var that = this
			
		if(!mode.tdd){
			settings.logPath = settings.lessonMaintenanceLogPath
			that.mongoUtils = mongoUtils
			asyncRequire('./logger').then(function(thisLogger){
				settings.logOptions.logPath = settings.logOptions.lessonMaintenanceLogPath
				that.logger = new thisLogger(settings.logOptions)
				that.logger.log(moduleName, 2,'init')
				asyncRequire('./mongoUtils').then(function(thisModule){
				that.mongoUtils = thisModule
					asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
						that.commonFunctions = thisCommonFunctions
						that.commonFunctions.init(that.logger, that.mongoUtils, null, function(){
							that.logger.log(moduleName, 2, 'Module running in Production mode')
							that.runTimer = setInterval(function(){
								that.isRunning = true
								that.processPhases(function(){
									
								})
							},500)
						})
					})
				})
			})
			
		} else {  	
			that.logger = logger
			that.logger.log(moduleName, 2,'init')
			//that.mongoUtils = mongoUtils
			asyncRequire('./mongoUtils').then(function(thisModule){
				that.mongoUtils = thisModule
				that.logger.log(moduleName, 2, 'Module running in TDD mode')  
				that.mongoUtils.init(that.logger, function(){
					that.logger.log(moduleName, 2, 'Mongo Initialised')
					asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
						that.commonFunctions = thisCommonFunctions
						that.commonFunctions.init(that.logger, that.mongoUtils, null, function(){
							callback()
						})
					})
				})
			})
		}
	},
	processPhases: function(callback){
 		var that = this
 		if(!that.isRunning){
 			that.logger.log(moduleName, 2, 'running lesson processor - checking for lessons in need...')
	 		that.processorPhaseIterator(0, function(){
				that.logger.log(moduleName, 2, 'Done running lesson processor')
	 		})	
 		}
	},
	processorPhaseIterator: function(phaseIdx, callback){
		var that = this
		switch(phaseIdx){
			case 0: 

				that.logger.log(moduleName, 2, 'Running Phase 0: getting a lesson which needs processing.')
				that.getPendingLesson(function(){
					if(that.thisLesson != null){
						that.processorPhaseIterator(phaseIdx +1, callback)
					} else {
						callback()
					}
				})
				break;
			case 1: 

				that.logger.log(moduleName, 2, 'Running Phase 0: processing lesson')
				that.processLesson(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				default:
				that.isRunning = false
				callback()
			break;
		}
	},
	getPendingLesson: function(callback){
		//callback with a lesson object which is a pending lesson. Update the lesson state to evaluating.
		var that = this
		that.logger.log(moduleName, 2, 'Running Phase get pending lesson')
		that.mongoUtils.getPendingLesson(function(thisLesson){
			if(thisLesson){
				that.lesson = thisLesson.value
				that.logger.log(moduleName, 2, 'Pending lesson: ' + JSON.stringify(that.lesson))
				callback()
			} else {
				callback()	
			}
		})
	},
	processLesson: function(callback){
		//iterate output configurations
		//process the actual lesson
		//for each output associated with the lesson, get data from the spheron.
		//
		var that = this
		that.lessonOutputGroupIterator(0, 0, function(){
			callback()
		})
	},
	lessonOutputGroupIterator: function(outputConfigIdx, outputIdx, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running lessonOutputGroupIterator')
		if(that.lesson.outputConfigurations[outputConfigIdx]){
			if(that.lesson.outputConfigurations[outputConfigIdx].activationFunction != null){
				if(that.lesson.outputConfigurations[outputConfigIdx].type == "sync"){
					//iterate the outputs and gather data from corresponding Spherons.
					that.getOutputDataBySigIdForOutputConfigIdx(outputConfigIdx, function(gatheredData){
						//ok so now gathered data should contain anything from these spherons outputs for this output.
						//we should now look for sync groups - i.e. signalId's filled with all of the outputs
						//if we find them, we should call the output function
						//then delete these signal ids from the spherons
						that.logger.log(moduleName, 2, 'done gathering data for a lesson sync output group')
						that.logger.log(moduleName, 2, 'data is:' + JSON.stringify(gatheredData))

						/*
						*
						*/

						process.exitCode = 1

						/*
						*
						*/

					})
				} else if(that.lesson.outputConfigurations[outputConfigIdx].type == "async"){
					//not supported yet
				} else {
					//not supported yet
				}
			} else {
				that.lessonOutputGroupIterator(outputConfigIdx +1,0, callback)
			}
		} else {
			that.logger.log(moduleName, 2, 'done iterating output configuration groups')
			callback()
		}
	},
	getOutputDataBySigIdForOutputConfigIdx: function(outputConfigIdx, callback){
		/*
		* For an outputconfig, gather all associated data grouped by sigId {sigidA: {}, sigidB: {}}
		*/
		
		var that = this
		that.getOutputDataBySigIdForOutputConfigIdxIterator(outputConfigIdx, 0, {}, function(gatheredData){
			that.logger.log(moduleName, 2, 'getOutputDataBySigIdForOutputConfigIdx finished gathering data: ' + JSON.stringify(gatheredData))
			callback(gatheredData)
		})
	},
	getOutputDataBySigIdForOutputConfigIdxIterator: function(outputConfigIdx, outputIdx, gatheredData, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running getOutputDataBySigIdForOutputConfigIdxIterator')
		if(that.lesson.outputConfigurations[outputConfigIdx].outputs[outputIdx]){
			// now gather data for this output from this spheron propagation queue. 
			// group by: signalId and merge with any already gathered data
			that.logger.log(moduleName, 2, 'spheronId is: ' + that.lesson.outputConfigurations[outputConfigIdx].outputs[outputIdx].spheronId)
			that.mongoUtils.getPropagationMessageQueueBySpheronId(that.lesson.outputConfigurations[outputConfigIdx].outputs[outputIdx].spheronId, function(spheronPropagationQueueData){

				var thisPortId = that.lesson.outputConfigurations[outputConfigIdx].outputs[outputIdx].port
				
				that.searchPropagationQueueDataForPortAndAddToGatheredData(spheronPropagationQueueData, thisPortId, gatheredData, 0, 0, function(gatheredData){
					//we have added the relevant data to the gatheredData object
					that.getOutputDataBySigIdForOutputConfigIdxIterator(outputConfigIdx, outputIdx+1, gatheredData, callback)
				})
			})
		} else {
			// we are done gathering data for this output group
			callback(gatheredData)
		}
	},
	searchPropagationQueueDataForPortAndAddToGatheredData: function(spheronPropagationQueueData, portId, gatheredData, propagationMessageQueueIdx, propagationMessageQueueIoIdx, callback){
		var that = this
		if(spheronPropagationQueueData[propagationMessageQueueIdx]){
			if(spheronPropagationQueueData[propagationMessageQueueIdx].io[propagationMessageQueueIoIdx]){
				that.logger.log(moduleName, 2, 'target port: ' + portId + ' data port: ' + spheronPropagationQueueData[propagationMessageQueueIdx].io[propagationMessageQueueIoIdx].output)
				if(spheronPropagationQueueData[propagationMessageQueueIdx].io[propagationMessageQueueIoIdx].output == portId){
					if(!gatheredData[spheronPropagationQueueData[propagationMessageQueueIdx].signalId]){
						that.logger.log(moduleName, 2, 'gathered data was empty for this sigId - so adding it')
						gatheredData[spheronPropagationQueueData[propagationMessageQueueIdx].signalId] = {}
						gatheredData[spheronPropagationQueueData[propagationMessageQueueIdx].signalId] = spheronPropagationQueueData[propagationMessageQueueIdx]
					} else {
						//push more IO strings to the existent object
						that.logger.log(moduleName, 2, 'gathered data has this sigId so appending to it')
						for(var v=0;v<spheronPropagationQueueData[propagationMessageQueueIdx].io.length;v++){
							gatheredData[spheronPropagationQueueData[propagationMessageQueueIdx].signalId].io.push(spheronPropagationQueueData[propagationMessageQueueIdx].io[v])
						}
					}
					that.searchPropagationQueueDataForPortAndAddToGatheredData(spheronPropagationQueueData, portId, gatheredData, propagationMessageQueueIdx, propagationMessageQueueIoIdx+1 , callback)
				} else {
					that.searchPropagationQueueDataForPortAndAddToGatheredData(spheronPropagationQueueData, portId, gatheredData, propagationMessageQueueIdx, propagationMessageQueueIoIdx+1 , callback)
				}
			} else {
				that.searchPropagationQueueDataForPortAndAddToGatheredData(spheronPropagationQueueData, portId, gatheredData, propagationMessageQueueIdx+1, 0, callback)
			}
		} else {
			callback(gatheredData)
		}
	}
}

module.exports = lessonMaintenanceProcessor;
