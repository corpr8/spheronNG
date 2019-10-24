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

var lessonManager = {
	logger: null, 
	mongoUtils: null,
	commonFunctions: null,
	lesson: null,
	isRunning: false,
	runTimer: null,
	thisActivationModule: null,
	mode: null,
	init: function(mode, logger, mongoUtils, callback){
		var that = this
		that.mode = mode
			
		if(!mode.tdd){
			settings.logPath = settings.lessonMaintenanceLogPath
			that.mongoUtils = mongoUtils
			asyncRequire('./logger').then(function(thisLogger){
				settings.logOptions.logPath = settings.logOptions.lessonMaintenanceLogPath
				that.logger = new thisLogger(settings.logOptions)
				that.logger.log(moduleName, 2,'init')
				asyncRequire('./mongoUtils').then(function(thisMongo){
					that.mongoUtils = thisMongo
					that.mongoUtils.init(that.logger, function(){
						asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
							that.commonFunctions = thisCommonFunctions
							that.commonFunctions.init(that.logger, that.mongoUtils, null, function(){
								that.logger.log(moduleName, 2, 'Module running in Production mode')
								that.runTimer = setInterval(function(){
									that.processPhases(function(){
										
									})
								},500)
							})
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
				that.logger.log(moduleName, 2, 'Done running lesson phase processor')
	 		})	
 		}
	},
	processorPhaseIterator: function(phaseIdx, callback){
		var that = this
		switch(phaseIdx){
			case 0: 
				that.logger.log(moduleName, 2, 'Running Phase 0: getting a lesson which needs processing.')
				that.getPendingLesson(function(){
					if(that.lesson != null){
						that.isRunning = true
						that.logger.log(moduleName, 2, 'we got lesson to process: ' + that.lesson.lessonId)
						that.processorPhaseIterator(phaseIdx +1, callback)
					} else {
						callback()
					}
				})
				break;
			case 1: 

				that.logger.log(moduleName, 2, 'Running running lessonInit if required (first time)')
				that.runInitIfRequired(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
			case 2: 

				that.logger.log(moduleName, 2, 'Running Phase 1: processing lesson')
				that.processLesson(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
			case 3: 

				that.logger.log(moduleName, 2, 'Running Phase 2: testing if lesson complete.')
				that.logger.log(moduleName, 2, '****TODO****')
				
				that.processorPhaseIterator(phaseIdx +1, callback)
				
			break;
			case 4: 

				that.logger.log(moduleName, 2, 'Running Phase 3: setting lesson state to idle.')
				that.setLessonToIdle(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				default:
				that.lesson = null
				that.isRunning = false
				callback()
			break;
		}
	},
	getPendingLesson: function(callback){
		//callback with a lesson object which is a pending lesson. Update the lesson state to evaluating.



		/*
		* Note: Currently, the lesson init function does not seem to fire...
		*/




		var that = this
		that.logger.log(moduleName, 2, 'Running Phase get pending lesson')
		that.mongoUtils.getPendingLesson(function(thisLesson){
			that.logger.log(moduleName, 2, 'pending lesson is: ' + JSON.stringify(thisLesson))

			if(thisLesson.value){
				that.lesson = thisLesson.value
				asyncRequire(that.lesson.activationModule).then(function(thisActivationModule){
					that.thisActivationModule = thisActivationModule

					/*
					*Added in as  test that.mode.tdd on 18.10.19
					*/
					if(!that.mode.tdd){
						that.thisActivationModule.init(null, that.lesson, that.logger, that.mongoUtils, function(){
							
							that.logger.log(moduleName, 2, 'Pending lesson: ' + JSON.stringify(that.lesson))
							callback()
						})
					} else {
						that.thisActivationModule.init('TDD', that.lesson, that.logger, that.mongoUtils, function(){
							
							that.logger.log(moduleName, 2, 'Pending lesson: ' + JSON.stringify(that.lesson))
							callback()
						})
					}
					
				})
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
		that.logger.log(moduleName, 2, 'running processLesson')
		if(that.lesson){
			that.lessonOutputGroupIterator(0, 0, function(){
				callback()
			})
		} else {
			that.logger.log(moduleName, 2, 'no lesson to process')
			callback()
		}
	},
	runInitIfRequired: function(callback){
		var that = this
		that.logger.log(moduleName, 2, 'running lessonInit if required')
		that.logger.log(moduleName, 2, 'that.lesson.ranInit is: ' + that.lesson.ranInit)

		if(that.lesson.ranInit != true){
			that.lesson.ranInit = true //TODO: Persist this in some way...
			that.logger.log(moduleName, 2, 'running lessonInit')





			//TODO: doesn't seem to work
			that.thisActivationModule.lessonInit(function(){
				that.logger.log(moduleName, 2, 'called back from lessonInit')
				callback()
			})



		} else {
			that.logger.log(moduleName, 2, 'no init to run')
			callback()
		}
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
						that.checkOutputDataSyncComplete(outputConfigIdx, gatheredData, function(){
							that.logger.log(moduleName, 2, 'done checking if the data is complete by sigId and calling the relevant activation function')
							callback()
						})
					})
				} else if(that.lesson.outputConfigurations[outputConfigIdx].type == "async"){
					//not supported yet
					that.logger.log(moduleName, 2, 'async groups not supported yet. Write support.')
					process.exitCode = 1
				} else {
					//not supported yet
					that.logger.log(moduleName, 2, 'other groups not supported yet. Write support.')
					process.exitCode = 1
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
				if(spheronPropagationQueueData){
					if(spheronPropagationQueueData.length > 0){
						that.searchPropagationQueueDataForPortAndAddToGatheredData(spheronPropagationQueueData, thisPortId, gatheredData, 0, 0, function(gatheredData){
							//we have added the relevant data to the gatheredData object
							that.getOutputDataBySigIdForOutputConfigIdxIterator(outputConfigIdx, outputIdx+1, gatheredData, callback)
						})
					} else {
						that.getOutputDataBySigIdForOutputConfigIdxIterator(outputConfigIdx, outputIdx+1, gatheredData, callback)
					}
				} else {
					that.getOutputDataBySigIdForOutputConfigIdxIterator(outputConfigIdx, outputIdx+1, gatheredData, callback)
				}
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
	},
	checkOutputDataSyncComplete: function(outputConfigIdx, gatheredData, callback){
		var that = this
		that.checkOutputDataSyncCompleteIterator(outputConfigIdx, gatheredData, 0, 0, 0, function(){
			callback()
		})
	},
	checkOutputDataSyncCompleteIterator: function(outputConfigIdx, gatheredData, gatheredDataSigIdIdx, outputConfigPortIdx, gatheredDataSigIdIoIdx, callback){
		var that = this
		that.logger.log(moduleName, 2, 'in checkOutputDataSyncCompleteIterator')
		if(Object.keys(gatheredData)[gatheredDataSigIdIdx]){
			var thisSigId = Object.keys(gatheredData)[gatheredDataSigIdIdx]
			if(that.lesson.outputConfigurations[outputConfigIdx].outputs[outputConfigPortIdx]){
				if(gatheredData[thisSigId].io[gatheredDataSigIdIoIdx]){
					/*
					*Iterate the io in this gathereData[gatheredDataSigIdIdx].io[gatheredDataSigIdIoIdx]
					*/
					if(gatheredData[thisSigId].io[gatheredDataSigIdIoIdx].output == that.lesson.outputConfigurations[outputConfigIdx].outputs[outputConfigPortIdx].port){
						//we found a match - iterate to the next output port
						that.checkOutputDataSyncCompleteIterator(outputConfigIdx, gatheredData, gatheredDataSigIdIdx, outputConfigPortIdx+1, 0, callback)
					} else {
						that.checkOutputDataSyncCompleteIterator(outputConfigIdx, gatheredData, gatheredDataSigIdIdx, outputConfigPortIdx, gatheredDataSigIdIoIdx+1, callback)
					}
				} else {
					//we did not find this port in the gather data io so its missing and we don't have a sync signal...
					//iterate to the next sigId
					that.checkOutputDataSyncCompleteIterator(outputConfigIdx, gatheredData, gatheredDataSigIdIdx+1, 0, 0, callback)
				}
			} else {
				/*
				* TODO:
				* we have iterated to the end of the outputs in the lesson, which means we found them all so we should take action!!!!
				* call the output function
				* delete this sigId from the relative output queues
				* if the output function causes back prop then good.
				* and iterate to the next gatheredDataSigIdIdx
				*/
				that.logger.log(moduleName, 2, 'we found a full sync output group with sigId: ' + thisSigId + '. - lets call the output function')

				//asyncRequire(that.lesson.outputConfigurations[outputConfigIdx].activationModule).then(function(thisActivationModule){
				//	that.thisActivationModule = thisActivationModule
					//that.logger.log(moduleName, 2, 'activationModule: ' + that.lesson.outputConfigurations[outputConfigIdx].activationModule + ' - loaded.')
					that.logger.log(moduleName, 2, 'passing the following lesson data: ' + JSON.stringify(that.lesson))

					//that.thisActivationModule.init('TDD', that.lesson, that.logger, that.mongoUtils, function(){
						that.logger.log(moduleName, 2, 'calling back from activationModule initialisation function')
						that.thisActivationModule[that.lesson.outputConfigurations[outputConfigIdx].activationFunction](gatheredData[thisSigId], function(){
							that.deletePropagationDataByOutputConfigIdxAndSigId(outputConfigIdx, thisSigId, function(){
								that.checkOutputDataSyncCompleteIterator(outputConfigIdx, gatheredData, gatheredDataSigIdIdx+1, 0, 0, callback)	
							})
						})
					//})
				//})
			}
		} else {
			callback()
		}
	},
	deletePropagationDataByOutputConfigIdxAndSigId: function(outputConfigIdx, sigId, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running deleteDataByOutputConfigIdxAndSigId')
		that.getSpheronIdsByOutputConfigIdxIterator(outputConfigIdx, 0, [], function(spheronIds){
			/*
			* TODO: update each spherons propagation queue
			* Delete each row where the sigId corresponds to sigId
			*/
			that.deleteSigIdsFromSpheronPropagationQueue(spheronIds, sigId, 0, function(){
				//eventually 
				callback()
			})
		})
	},
	getSpheronIdsByOutputConfigIdxIterator: function(outputConfigIdx, idx, spherons, callback){
		var that = this
		if(that.lesson.outputConfigurations[outputConfigIdx].outputs[idx]){
			spherons.push(that.lesson.outputConfigurations[outputConfigIdx].outputs[idx].spheronId)
			that.getSpheronIdsByOutputConfigIdxIterator(outputConfigIdx, idx+1, spherons, callback)
		} else {
			callback(spherons)
		}
	},
	deleteSigIdsFromSpheronPropagationQueue: function(spheronIds, targetSigId, idx, callback){
		var that = this
		if(spheronIds[idx]){
			that.mongoUtils.deleteSigIdFromSpheronPropagationQueue(spheronIds[idx], targetSigId, function(){
				that.deleteSigIdsFromSpheronPropagationQueue(spheronIds, targetSigId, idx+1, callback)
			})
		} else {
			callback()
		}
	},
	setLessonToIdle: function(callback){
		var that = this
		if(that.lesson){
			that.mongoUtils.setLessonAsIdle(that.lesson.lessonId, function(){
				//including setting ranInit as true... (we must have)
				callback()
			})
		} else {
			callback()
		}
		
	}
}

module.exports = lessonManager;
