var moduleName = 'multivariateTestProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');

/*
* Module to handle resolving multivariant tests.
* 1: Check if we have a complete set of records for a test where the path is consistent for all records.
* 2: > decide which connection wins.
* 3: > ammend upstream or downstream spherons as appropriate
* 4: > delete losing connections
* 5: > clear up all mvTest data associated with all connections in the test
* 6: > delete the MV test itself
*/ 

var multivariateTestProcessor = {
	spheron: null,
	logger: null, 
	mongoUtils: null,
	init: function(thisSpheron, logger, mongoUtils, callback){

		var that = this
		that.logger = logger
		that.spheron = thisSpheron
		that.logger.log(moduleName, 2,'init')
			
		if(!that.spheron.tdd){
			that.mongoUtils = mongoUtils
			that.logger.log(moduleName, 2, 'Module running in Production mode')
			that.processPhases(function(){
				callback(that.spheron)
			}) 
		} else {  	
			asyncRequire('./mongoUtils').then(function(thisModule){
				that.mongoUtils = thisModule
				that.logger.log(moduleName, 2, 'Module running in TDD mode')  
				that.mongoUtils.init(that.logger, function(){
					that.logger.log(moduleName, 2, 'Mongo Initialised')
					that.spheron.init(that.logger, function(){ //not sure if we need to run init in this mode either?!?!
						that.logger.log(moduleName, 2, 'Spheron initialised')
						callback()
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

				that.logger.log(moduleName, 2, 'Running Phase 0: iterating multivariant tests')
				that.mvTestIterator(function(){
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
	nukeTestData: function(callback){
		var that = this
		that.mongoUtils.dropDb(function(){
			callback() 
		})
	},
	setupTestDataByFileName: function(testDataFileName, callback){
		var that = this
		that.logger.log(moduleName, 2, 'calling setup test data') 
		that.mongoUtils.setupDemoDataFromFile(testDataFileName, function(){
			that.logger.log(moduleName, 2, 'test data loaded into mongo')
			callback() 
		})
	},
	mvTestIterator: function(callback){
		//iterate variants of inputs, biases and outputs and call resolveIfMVTestCompleteFromMVObject for each one...
		that.logger.log(moduleName, 2, 'running test iterator - BackProp MV test resolution.') 
		process.exitCode = 1
	},
	getCompletedTestsByIoName: function(ioName, testLength, callback){
 		var that = this
 		that.getCompletedTestsByIoNameIterator(ioName, 0, -1, 0, testLength, {}, function(completedTestsObject){
 			callback(completedTestsObject)
 		})
	},
	getLessonLength: function(lessonId, callback){ 
		var that = this
		that.logger.log(moduleName, 2, 'running get lesson length')
		//callback(4)
		
		that.mongoUtils.getLessonLength(lessonId, function(lessonLength){
			callback(lessonLength)
		}) 
		 
	},
	getErrorMapsByIoName: function(ioName, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running get lesson length')
		that.getErrorMapsByIoNameIterator(ioName, 0, function(lessonLength){
			callback(lessonLength)
		})
	},
	getErrorMapsByIoNameIterator: function(ioName, ioIdx, callback){
		var that = this
		if(that.spheron.io[ioIdx]){
			if(that.spheron.io[ioIdx].id == ioName){
				callback(that.spheron.io[ioIdx].errorMap)
			} else {
				that.getErrorMapsByIoNameIterator(ioName, ioIdx+1, callback)
			}
		} else {
			callback(null)
		}
	},
	getCompleteTestFromErrorObject: function(ioObject, lessonLength, callback){
		// test an individual error object to see if it is complete:
		// where an object is:
		// 
		var that = this
		that.logger.log(moduleName, 2, 'running getCompleteTestFromErrorObject')
		that.getCompleteTestFromErrorObjectIterator(ioObject, lessonLength, 0, 0, function(returnObject){
			that.logger.log(moduleName, 2, 'back from getCompleteTestFromErrorObjectIterator')
			that.logger.log(moduleName, 2, 'rms error is: ' + returnObject)
			callback(returnObject)
		})	
	},
	getCompleteTestFromErrorObjectIterator: function(ioObject, lessonLength, ioObjectIdx, aggregateError, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running getCompleteTestFromErrorObjectIterator')
		if(ioObjectIdx <= lessonLength){
			if(ioObjectIdx == lessonLength){
				//note we should root this
				var root = Math.sqrt(aggregateError)
				var rmsError = (Math.floor((root / lessonLength) * 10000) / 10000)
				that.logger.log(moduleName, 2, 'rms error: ' + rmsError)
				callback( rmsError )
			} else {
				if(ioObject[ioObjectIdx]){
					aggregateError += Math.pow(ioObject[ioObjectIdx], 2)
					that.getCompleteTestFromErrorObjectIterator(ioObject, lessonLength, ioObjectIdx+1, aggregateError, callback)
				} else {
					callback(false)
				}
			}
		} else {
			callback(false) 
		}
	},
	getCompleteTestsByPortIdAndLessonName: function(portId, lessonName, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running getCompleteTestsByPortIdAndLessonName')
		that.getLessonLength(lessonName, function(lessonLength){
			that.logger.log(moduleName, 2, 'lesson name is:' + lessonName + ' lesson length is: ' + lessonLength)
			if(lessonLength && lessonLength > 0){
				that.getErrorMapsByIoName(portId, function(errorMaps){
					that.logger.log(moduleName, 2, portId + ' error map is: ' + JSON.stringify(errorMaps))
					if(errorMaps){
						that.getCompleteTestsByPortIdErrorMapsIterator(errorMaps, lessonLength, [], 0, function(completeTestArray){
							that.logger.log(moduleName, 2, 'completeTestArray:  ' + JSON.stringify(completeTestArray))
							callback(completeTestArray)
						})
					} else {
						callback()
					}
				})
			} else {
				callback()
			}
		})
	},
	getCompleteTestsByPortIdErrorMapsIterator: function(errorMaps, lessonLength, completeTestArray, idx, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running getCompleteTestsByPortIdErrorMapsIterator')
		if(errorMaps[idx]){
			that.logger.log(moduleName, 4, 'errorMaps[' + idx +'] exists')
			var thisTestObject = {
				signalPath: errorMaps[idx].signalPath 
			}
			that.logger.log(moduleName, 4, 'thisTestObject is: ' + JSON.stringify(thisTestObject))
			that.getCompleteTestFromErrorObject(errorMaps[idx].errorMap, lessonLength, function(result){
				if(result){
					thisTestObject.rmsError = result 
					that.logger.log(moduleName, 4, 'thisTestObject is: ' + JSON.stringify(thisTestObject))
					completeTestArray.push(thisTestObject)
					that.getCompleteTestsByPortIdErrorMapsIterator(errorMaps, lessonLength, completeTestArray, idx+1, callback)
				} else {
					that.getCompleteTestsByPortIdErrorMapsIterator(errorMaps, lessonLength, completeTestArray, idx+1, callback)
				}
			})
		} else {
			callback(completeTestArray)
		}
	},
	resolveIfMVTestComplete: function(variants, lessonName, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running resolveIfMVTestComplete')
		that.resolveIfMVTestCompleteIterator(variants, 0, lessonName, {}, function(result){
			that.logger.log(moduleName, 2, 'completeness:' + JSON.stringify(result))
			callback(result)
		})	
	},
	resolveIfMVTestCompleteIterator: function(variants, idx, lessonName, completionMap, callback){
		var that = this
		if(variants[idx]){
			if(variants[idx] == 'none'){
				that.searchForNone(variants, lessonName, function(searchForNoneResult){
					if(searchForNoneResult){
						/*
						* ok so the searchForNoneResult has been prepard to put into the completionMap...
						*/
						completionMap.push(searchForNoneResult)
						that.resolveIfMVTestCompleteIterator(variants, idx+1, lessonName, completionMap, callback)
					} else {
						//we do not have a 'none' test completed so we do not have a complete A/B test
						callback()
					}
				})
			} else {
				that.getCompleteTestsByPortIdAndLessonName(variants[idx], lessonName, function(result){
					if(result){
						completionMap[variants[idx]] = result
						that.resolveIfMVTestCompleteIterator(variants, idx+1, lessonName, completionMap, callback)
					} else {
						//this result was not complete so call back... 
						callback()
					}
					
				})
			}
		} else{			
			/*
			* Note: Currently we are assuming that only 1 test is complete in a map so we are taking the first index of something complete. This is a flawed assumption...
			*/
			that.logger.log(moduleName, 2, 'completion map: ' + JSON.stringify(completionMap))
			var winnersRMSerror = false
			var winner = false
			Object.keys(completionMap).forEach(function(thisKey) {
			    if(!winner || completionMap[thisKey][0].rmsError < winnersRMSerror){
			    	winner = thisKey
			    	winnersRMSerror = completionMap[thisKey][0].rmsError
			    }
			});

			if(winner){
				callback({
					winner: winner,
					rmsError: winnersRMSerror
				})
			} else {
				callback()
			}
		}
	},
	searchForNone: function(variants, lessonName, callback){
		var that = this
		that.searchForNoneIoIterator(variants, lessonName, 0, function(result){

/*
*
* This result has to be turned into a completion object just like a positive result
*/






			callback(result)
		})
	},
	searchForNoneIoIterator:function(variants, lessonName, Idx, callback){
		var that = this
		if(that.spheron.io[idx]){
			if(variants.indexOf(that.spheron.io[idx].id) == -1) {
				that.searchForNoneIoTestIterator(variants, lessonName, Idx, 0, function(completeTests){
					if(completeTests){
						//handle the completed test and turn it into a test result object for processing,...
						//then call back.
					} else {
						that.searchForNoneIoIterator(variants, lessonName, Idx+1, callback)
					}
				})
			} else {
				that.searchForNoneIoIterator(variants, lessonName, Idx+1, callback)
			}
		} else {
			callback()
		}
	},
	searchForNoneIoTestIterator:function(variants, lessonName, Idx, testIdx, callback){
		if(that.spheron.io[idx].errorMap[testIdx]){

		} else {
			callback()
		}
	},
	getConnectionTypeById: function(connectionId, callback){
		var that = this
		that.getConnectionTypeByIdIterator(0, connectionId, function(connectionType){
			callback(connectionType)
		})
	},
	getConnectionTypeByIdIterator: function(idx, connectionId, callback){
		var that = this
		if(that.spheron.io[idx]){
			if(that.spheron.io[idx].id == connectionId){
				callback(that.spheron.io[idx].type)
			} else {
				that.getConnectionTypeByIdIterator(idx+1, connectionId, callback)
			}
		} else {
			callback()
		}
	},
	resolveIfMVTestCompleteFromMVObject: function(mvTestObject, lessonName, callback){
		var that = this

		that.logger.log(moduleName, 2, 'running resolveIfMVTestCompleteFromMVObject')
		var allInputs = [mvTestObject.original]
		that.logger.log(moduleName, 2, 'mvTestObject:' + JSON.stringify(mvTestObject))		
		mvTestObject.variants.forEach(function(thisObject){
			allInputs.push(thisObject)
		})

		that.logger.log(moduleName, 2, 'all inputs: ' + allInputs)
		that.resolveIfMVTestComplete(allInputs, lessonName, function(result){
			that.logger.log(moduleName, 2, 'resolveIfMVTestCompleteFromMVObject result: ' + JSON.stringify(result))
			if(result){
				that.getConnectionTypeById(result.winner, function(connectionType){
					if(connectionType == "extInput"){
						if(result.winner == mvTestObject.original){
							that.logger.log(moduleName, 2, 'concluding MV Test, existent extInput won.')
						
							/*
							* winner is the existent extInput:
							* > Delete variants
							* > Delete all test data in this speheron
							* > Delete the test object
							*/

						} else {
							that.logger.log(moduleName, 2, 'concluding MV Test, variant extInput won.')
							/*
							* winner is a variant extInput:
							* > find test which feeds the existent input
							* > update toPort to point to variant extInput
							* > delete all test data
							* > delete test object
							*/
						}
					} else if(connectionType == "input"){
						if(result.winner == mvTestObject.original){
							that.logger.log(moduleName, 2, 'concluding MV Test, existent input won.')
							/*
							* winner is the existent input:
							* > Delete variants
							* > Delete all test data in this speheron
							* > Delete the test object
							* 
							*/

						} else {
							that.logger.log(moduleName, 2, 'concluding MV Test, variant input won.')
							/*
							* winner is a variant:
							* > find upstream spheron
							* > update toPort to point to variant connection
							* > delete all test data
							* > delete test object
							*/
						}
					} else if(connectionType == "bias"){
						that.logger.log(moduleName, 2, 'concluding MV Test, a bias won.')
						/*
						* > Delete other biases in this test
						* > Delete all test data in this speheron
						* > Delete the test object
						*/

					} else if(connectionType == "output"){
						if(result.winner == mvTestObject.original){
							that.logger.log(moduleName, 2, 'concluding MV Test, existent output won.')
							/*
							* winner is the existent output:
							* > Delete variants
							* > Delete all test data in this speheron
							* > Delete the test object
							*/
						} else {
							that.logger.log(moduleName, 2, 'concluding MV Test, variant output won.')
							/*
							* winner is a variant output:
							* > find downstream spheron
							* > update frmoPort to point to variant output
							* > delete all test data
							* > delete test object
							*/
						}
					} else if(connectionType == "extOutput"){
						if(result.winner == mvTestObject.original){
							that.logger.log(moduleName, 2, 'concluding MV Test, existent extOutput won.')
							/*
							* winner is the existent extOutput:
							* > Delete variants
							* > Delete all test data in this speheron
							* > Delete the test object
							*/
						} else {
							that.logger.log(moduleName, 2, 'concluding MV Test, variant extOutput won.')
							/*
							* winner is a variant extOutput:
							* > find test which is fed by the existent output
							* > update frmoPort to point to variant extOutput
							* > delete all test data
							* > delete test object
							*/
						}
					} else if(connectionType == "none"){
						that.logger.log(moduleName, 2, 'concluding MV Test, variant extOutput won.')
						/*
						* winner is none of the variants:
						* > if other variants are inputs or outputs de-wire them in the upstream / downstream spherons
						* > if other variants are extInputs or extOutputs then this is a null test and not a supported usecase
						* > delete other port variants in this object
						* > delete all test data for whole spheron
						* > delete test object
						*/
					}
				})
			} else {
				that.logger.log(moduleName, 2, 'not complete. Nothing else to do at this juncture.')
				callback()
			}
		})
	}
}
 
module.exports = multivariateTestProcessor;
