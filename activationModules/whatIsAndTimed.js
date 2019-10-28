var moduleName = 'whatIsAndTimed'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');
var generateUUID = require(appDir + '/generateUUID.js')
/*
* Module which supports the lesson: whatIsAnd:
* > Provides functions which are called when the data fills the syncOutput group - which in this case is a single output
* So, check the result and back propagate (if in training mode), then fire the next lesson to the inputs
* > lessonInit - fire first lesson into the network.
*
*/ 

var whatIsAnd = {
	mode: null,
	logger: null, 
	mongoUtils: null,
	commonFunctions: null,
	lesson: null,
	thisTimer: null,
	init: function(mode, lesson, logger, mongoUtils, callback){
		var that = this
		that.logger = logger
		that.lesson = lesson
		that.mode = mode

		that.logger.log(moduleName, 2,'init')
		that.logger.log(moduleName, 2, 'lesson is: ' + JSON.stringify(that.lesson))
		that.logger.log(moduleName, 2, 'lesson length is: ' + that.lesson.lesson.length)

		if(mode != 'TDD'){
			that.mongoUtils = mongoUtils
			asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
				that.commonFunctions = thisCommonFunctions
				that.commonFunctions.init(that.logger, that.mongoUtils, null, function(){
					that.logger.log(moduleName, 2, 'Module running in Production mode')
					callback()
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
						that.commonFunctions.init(that.logger, that.mongoUtils, null, function(){
							callback()
						})
					})
				})
			})
		}
	},
	lessonInit: function(callback){
		/*
		* TODO
		*/
		var that = this
		that.logger.log(moduleName, 2, 'running lesson init (inside init function)')
		that.thisTimer = setInterval(function(){
			if(that.lesson.options.mode == "autoTrain"){
				that.logger.log(moduleName, 2, 'pushing a lesson[idx] onto the stack') 
				that.pushLessonToStackIterator(null, 0, null)
			} else {
				that.clearTimeout(that.thisTimer)	
			}
		},2000)
		callback()
	},
	whatIsAndOutputFunction: function(syncSignalIdObject, callback){
		var that = this
		that.logger.log(moduleName, 2, 'whatIsAndOutputFunction called with:' + JSON.stringify(syncSignalIdObject))
		/*
		* 
		*	{"lessonId":"whatIsAnd","lessonIdx":0,"signalId":"1000","io":[
		*		{"signalPath":"input1;input2;input3;bias1;internal1;ANDout","output":"ANDout","val":15.82635},
		*		{"signalPath":"input1;input2;input3;bias1;internal3;NOTANDout","output":"NOTANDout","val":5.82635}
		*	]}
		*/
		that.whatIsAndOutputFunctionIterator(syncSignalIdObject, 0, function(){
			/*
			* Fire the next input as this signalId has been removed from the stack.
			* TODO: only if lesson is not learnt
			*/
			var lessonLength = that.lesson.lesson.length
			var lessonIdx = syncSignalIdObject.lessonIdx
			that.logger.log(moduleName, 2, 'lessonLength is:' + lessonLength + ' lessonIdx is: ' + lessonIdx)
			callback()
		})		
	},
	pushLessonToStackIterator: function(lessonIdx, inputIdx, sigGUID){
		var that = this
		try{
			that.logger.log(moduleName, 2, 'activation function is running in mode: ' + that.mode)

			/*
			* TODO: if lessonIdx is null 
			* get the last pushed lessonIdx from the lesson and increment it in the db for next run.
			* put the value in lessonIdx so it applies to all inputs for this set of iterations...
			*/

			if(!lessonIdx){
				that.mongoUtils.getIncrementLessonIdx(that.lesson.lessonId, function(nextIdx){
					lessonIdx = nextIdx
					if(that.mode == "TDD"){
						//assign a static lessonGUID
						sigGUID = "TestSigGUID"
					} else {
						sigGUID = (sigGUID) ? sigGUID : generateUUID()
					}
					that.pushLessonToStackIterator(lessonIdx, inputIdx, sigGUID)
				})
			} else {
				/*
				* For each output in the lesson, push a message to the relevant spherons input queue.
				* Note: assumes each spheron has max 1 input
				*/
				
				/*
				that.logger.log(moduleName, 2, 'lessonIdx is: ' + lessonIdx)
				that.logger.log(moduleName, 2, 'that.lesson.lesson is: ' + JSON.stringify(that.lesson.lesson))
				that.logger.log(moduleName, 2, 'that.lesson.lesson[lessonIdx] is: ' + JSON.stringify(that.lesson.lesson[lessonIdx]))
				that.logger.log(moduleName, 2, 'inputIdx is: ' + inputIdx )
				that.logger.log(moduleName, 2, 'that.lesson.lesson[lessonIdx].inputs is: ' + JSON.stringify(that.lesson.lesson[lessonIdx].inputs))
				that.logger.log(moduleName, 2, 'Object.keys(that.lesson.lesson[lessonIdx].inputs)[inputIdx] is: ' + JSON.stringify(Object.keys(that.lesson.lesson[lessonIdx].inputs)[inputIdx]))
				that.logger.log(moduleName, 2, 'that.lesson.lesson[lessonIdx].inputs[Object.keys(that.lesson.lesson[lessonIdx].inputs)[inputIdx]] is: ' + JSON.stringify(that.lesson.lesson[lessonIdx].inputs[Object.keys(that.lesson.lesson[lessonIdx].inputs)[inputIdx]]))
				*/

				//setTimeout(function(){
					if(that.lesson.lesson[lessonIdx].inputs[Object.keys(that.lesson.lesson[lessonIdx].inputs)[inputIdx]]){
						//work out the destination spheron
						//build the message
						//push to input queue
						var targetSpheron = Object.keys(that.lesson.lesson[lessonIdx].inputs)[inputIdx]
						var targetPort = Object.keys(that.lesson.lesson[lessonIdx].inputs[targetSpheron])[0]
						var targetValue = that.lesson.lesson[lessonIdx].inputs[targetSpheron][targetPort].val

						var thisMessage = {
							"lessonId" : that.lesson.lessonId,
							"toPort" : targetPort,
							"path" : targetPort,
							"lessonIdx" : lessonIdx,
							"val" : targetValue,
							"sigId" : sigGUID
						}
						
						
						// push to targetSpheron input queue
						 

						that.mongoUtils.pushMessageToInputQueueBySpheronIdAndPort({toId: targetSpheron, toPort: targetPort}, thisMessage, function(){
							//eventually
							that.pushLessonToStackIterator(lessonIdx, inputIdx+1, sigGUID)
						})			
					} else {
						//nothing to do????
						that.logger.log(moduleName, 2, 'nothing to do? ')
					}	
				//},2000)
			
			}
		} catch(err){
			that.logger.log(moduleName, 2, 'failure in activation function: ' + err.message)
		}		
	},
	whatIsAndOutputFunctionIterator: function(syncSignalIdObject, idx, callback){
		var that = this
		var trimmedSignalObject = syncSignalIdObject
		//that.logger.log(moduleName, 2, 'trimmedSignalObject is:' + JSON.stringify(trimmedSignalObject))
		if(trimmedSignalObject.io[idx]){
			/*
			* We need to generate messages in the form:
			*
			* {"signalPath":"input1;input2;input3;bias1;internal2;","error":0.82635,"lessonId":"whatIsAnd","sigId":"1000","lessonIdx":0}
			*/
			that.getSpheronFromOutputIdInLessonIterator(trimmedSignalObject.io[idx].output, trimmedSignalObject.lessonIdx, 0, trimmedSignalObject.io[idx].val, function(spheronData){
				that.logger.log(moduleName, 2, 'found spheron and target value: ' + JSON.stringify(spheronData) + ' to backprop to.')
				if(spheronData != -1){
					var bpErrorMessage = {
						"signalPath" : trimmedSignalObject.io[idx].signalPath,
						"error" : spheronData.error,
						"lessonId" : trimmedSignalObject.lessonId,
						"sigId" : trimmedSignalObject.signalId,
						"lessonIdx" : trimmedSignalObject.lessonIdx,
						"bpSignalDepth": 0
					}	
					
					that.logger.log(moduleName, 2, 'BPerror object is: ' + JSON.stringify(bpErrorMessage))
					//now push the object onto the spheronsBP Queue
					that.mongoUtils.pushToUpstreamSpheronBPQueueBySpheronId(spheronData.spheronId, bpErrorMessage, function(){
						that.logger.log(moduleName, 2, 'Pushed to upstream spheron')
						that.whatIsAndOutputFunctionIterator(syncSignalIdObject, idx+1, callback)
					})
				} else {
					that.logger.log(moduleName, 2, 'Not possible to push upstream. Investigate...')
					that.whatIsAndOutputFunctionIterator(syncSignalIdObject, idx+1, callback)
				}
			})
		} else {
			callback()
		}
	},
	getSpheronFromOutputIdInLessonIterator: function(portId, lessonIdx, lessonOutputIdx, actualValue, callback){
		//iterate and search for a matching port...
		var that = this 
		var thisLesson = that.lesson.lesson[lessonIdx]
		if(Object.keys(thisLesson.outputs)[lessonOutputIdx]){
			if(thisLesson.outputs[Object.keys(thisLesson.outputs)[lessonOutputIdx]][portId]){
				/*
				* we should also callback the value for this lessonIdx
				*/
				var desiredValue = thisLesson.outputs[Object.keys(thisLesson.outputs)[lessonOutputIdx]][portId].val
				var thisError = (Math.floor((Math.abs(desiredValue - actualValue)) * 10000))/10000
				/*
				* update the lesson error for the lessonIdx
				*/
				that.mongoUtils.updateLessonError(that.lesson.lessonId, lessonIdx, Object.keys(thisLesson.outputs)[lessonOutputIdx], portId, thisError, function(){
					callback({
						"spheronId" : Object.keys(thisLesson.outputs)[lessonOutputIdx],
						"error" : thisError,
					})
				})
			} else {
				that.getSpheronFromOutputIdInLessonIterator(portId, lessonIdx, lessonOutputIdx+1, actualValue, callback)
			}
		} else {
			callback(-1)
		}
	}
}
module.exports = whatIsAnd;
