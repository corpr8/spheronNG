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

				that.logger.log(moduleName, 2, 'Running Phase 0: iterating multivariant tests')
				that.mvTestIterator(0, 0, function(){
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
	mvTestIterator: function(testPhase, testIdx, callback){
		//iterate variants of inputs, biases and outputs and call resolveIfMVTestCompleteFromMVObject for each one...
		var that = this
		that.logger.log(moduleName, 2, 'running test iterator - MV test resolution.') 
		if(testPhase < 3){
			if(testPhase == 0){
				//input tests
				if(that.spheron.variants.inputs[testIdx]){
					that.resolveIfMVTestCompleteFromMVObject(that.spheron.variants.inputs[testIdx], that.spheron.lessonId, function(result){
						that.handleCompleteMVTest(result, that.spheron.variants.inputs[testIdx], function(){
							that.mvTestIterator(testPhase, testIdx+1, callback)
						})
					})
				} else {
					that.mvTestIterator(testPhase+1, 0, callback)
				}
			} else if(testPhase == 1){
				//bias tests
				if(that.spheron.variants.biases[testIdx]){
					that.resolveIfMVTestCompleteFromMVObject(that.spheron.variants.biases[testIdx], that.spheron.lessonId, function(result){
						that.handleCompleteMVTest(result, that.spheron.variants.biases[testIdx], function(){
							that.mvTestIterator(testPhase, testIdx+1, callback)
						})
					})
				} else {
					that.mvTestIterator(testPhase+1, 0, callback)
				}
			} else {
				//output tests
				if(that.spheron.variants.outputs[testIdx]){
					that.resolveIfMVTestCompleteFromMVObject(that.spheron.variants.outputs[testIdx], that.spheron.lessonId, function(result){
						that.handleCompleteMVTest(result, that.spheron.variants.outputs[testIdx], function(){
							that.mvTestIterator(testPhase, testIdx+1, callback)
						})
					})
				} else {
					that.mvTestIterator(testPhase+1, 0, callback)
				}
			}
		} else {
			callback()
		}
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
		that.logger.log(moduleName, 2, 'running getErrorMapsByIoName')
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
		that.logger.log(moduleName, 2, 'running getCompleteTestFromErrorObject. Lesson length is:' + lessonLength + ' ioObject is: ' + JSON.stringify(ioObject))
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
		that.logger.log(moduleName, 2, 'lesson name is: ' + lessonName)
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
			if(result){
				callback(result)
			} else {
				callback()
			}
			
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
						that.logger.log(moduleName, 2, 'completionMap is: ' + JSON.stringify(completionMap))
						completionMap["none"] = [{"signalPath" : "NA" ,"rmsError" : searchForNoneResult}]
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
				that.logger.log(moduleName, 2, 'this key is: ' + thisKey)
				if(completionMap[thisKey][0]){
					if(!winner || completionMap[thisKey][0].rmsError < winnersRMSerror){
				    	winner = thisKey
				    	winnersRMSerror = completionMap[thisKey][0].rmsError
				    }	
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
		that.logger.log(moduleName, 2, 'running searchForNone')
		that.getLessonLength(lessonName, function(lessonLength){
			that.searchForNoneIoIterator(variants, lessonName, lessonLength, 0, function(completeTest){
				callback(completeTest)
			})	
		})
	},
	searchForNoneIoIterator:function(variants, lessonName, lessonLength, idx, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running searchForNoneIterator - iterating io')
		if(that.spheron.io[idx]){
			that.logger.log(moduleName, 2, 'variants:' + variants.join(','))
			that.logger.log(moduleName, 2, 'variants index of:' + that.spheron.io[idx].id + ': ' + variants.indexOf(that.spheron.io[idx].id))
			if(variants.indexOf(that.spheron.io[idx].id) == -1) {
				/*
				* note: we need to check and see if we need to implement the below in normal tests...
				*/
				that.searchForNoneWithinIoMapsIterator(that.spheron.io[idx].errorMap, 0, lessonLength, function(result){
					if(result){
						callback(result)
					} else {
						that.searchForNoneIoIterator(variants, lessonName, lessonLength, idx+1, callback)
					}
				})
			} else {
				that.searchForNoneIoIterator(variants, lessonName, lessonLength, idx+1, callback)
			}
		} else {
			callback()
		}
	},
	searchForNoneWithinIoMapsIterator: function(parentErrorMap, errorMapIdx, lessonLength, callback){
		var that = this
		if(parentErrorMap[errorMapIdx]){
			that.getCompleteTestFromErrorObject(parentErrorMap[errorMapIdx].errorMap, lessonLength, function(completeTest){
				if(completeTest){
					that.logger.log(moduleName, 2, 'found a complete none test: ' + JSON.stringify(completeTest))
					callback(completeTest)
				} else {
					that.searchForNoneWithinIoMapsIterator(parentErrorMap, errorMapIdx+1, lessonLength, callback)
				}
			})
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
	getDownstreamSpheronByConnectionId: function(connectionId, callback){
		var that = this
		that.getDownstreamSpheronByConnectionIdIterator(0, connectionId, function(connectionType){ 
			callback(connectionType)
		})
	},
	getDownstreamSpheronByConnectionIdIterator: function(idx, connectionId, callback){
		var that = this
		if(that.spheron.io[idx]){
			that.logger.log(moduleName, 2, 'connectionId: ' + connectionId + ' toPort:' + that.spheron.io[idx].toPort)
			if(that.spheron.io[idx].toPort == connectionId){
				callback(that.spheron.io[idx].toId)
			} else {
				that.getDownstreamSpheronByConnectionIdIterator(idx+1, connectionId, callback)
			}
		} else {
			callback()
		}
	},
	getUpstreamSpheronByConnectionId: function(connectionId, callback){
		var that = this
		that.getUpstreamSpheronByConnectionIdIterator(0, connectionId, function(connectionType){ 
			callback(connectionType)
		})
	},
	getUpstreamSpheronByConnectionIdIterator: function(idx, connectionId, callback){
		var that = this
		if(that.spheron.io[idx]){
			that.logger.log(moduleName, 2, 'connectionId: ' + connectionId + ' fromPort:' + that.spheron.io[idx].fromPort)
			if(that.spheron.io[idx].fromPort == connectionId){
				callback(that.spheron.io[idx].fromId)
			} else {
				that.getUpstreamSpheronByConnectionIdIterator(idx+1, connectionId, callback)
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
		that.logger.log(moduleName, 2, 'lessonName:' + lessonName)
		mvTestObject.variants.forEach(function(thisObject){
			allInputs.push(thisObject)
		})

		that.logger.log(moduleName, 2, 'all inputs: ' + allInputs)
		that.resolveIfMVTestComplete(allInputs, lessonName, function(result){
			that.logger.log(moduleName, 2, 'resolveIfMVTestCompleteFromMVObject result: ' + JSON.stringify(result))
			if(result){
				callback(result)
			} else {
				callback()
			}
		})
	},
	handleCompleteMVTest: function(result, mvTestObject, callback){
		var that = this
		if(result){
			that.getConnectionTypeById(result.winner, function(connectionType){
				if(connectionType == "extInput"){
					if(result.winner == mvTestObject.original){
						that.logger.log(moduleName, 2, 'concluding MV Test, existent extInput won.')
							
						/*
						* winner is the existent extInput:
						* > Delete variants
						* > Delete all test data in this spheron
						* > Delete the test object
						*/
						that.resetToOriginal(mvTestObject, function(){
							callback()
						})
					} else {
						that.logger.log(moduleName, 2, 'concluding MV Test, variant extInput won.')
						/*
						* winner is a variant extInput:
						* > find test which feeds the existent input
						* > update toPort to point to variant extInput
						* > delete all test data
						* > delete test object
						*/
						that.handleVariantExtInputWins(mvTestObject, result, function(){
							callback()
						})
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
						that.resetToOriginal(mvTestObject, function(){
							callback()
						})
					} else {
						that.logger.log(moduleName, 2, 'concluding MV Test, variant input won.')
						/*
						* winner is a variant:
						* > find upstream spheron
						* > update toPort to point to variant connection (including deleting any MV tests the original port was part of)
						* > delete all test data
						* > delete test object
						*/
						that.handleVariantInputWins(mvTestObject, result, function(){
							callback()
						})
					}
				} else if(connectionType == "bias"){
					that.logger.log(moduleName, 2, 'concluding MV Test, a bias won.')
					/*
					* > Delete other biases in this test
					* > Delete all test data in this speheron
					* > Delete the test object
					*/
					that.handleBiasWon(mvTestObject, result, function(){
						callback()
					})
				} else if(connectionType == "output"){
					if(result.winner == mvTestObject.original){
						that.logger.log(moduleName, 2, 'concluding MV Test, existent output won.')
						/*
						* winner is the existent output:
						* > Delete variants
						* > Delete all test data in this speheron
						* > Delete the test object
						*/
						that.resetToOriginal(mvTestObject, function(){
							callback()
						})
					} else {
						that.logger.log(moduleName, 2, 'concluding MV Test, variant output won.')
						/*
						* winner is a variant output:
						* > find downstream spheron
						* > update fromPort to point to variant output
						* > delete all test data
						* > delete test object
						*/
						that.handleVariantOutputWins(mvTestObject, result, function(){
							callback()
						})
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
						that.resetToOriginal(mvTestObject, function(){
							callback()
						})
					} else {
						that.logger.log(moduleName, 2, 'concluding MV Test, variant extOutput won.')
						/*
						* winner is a variant extOutput:
						* > find test which is fed by the existent output
						* > update fromPort to point to variant extOutput
						* > delete all test data
						* > delete test object
						*/
						that.handleVariantExtOutputWins(mvTestObject, result, function(){
							callback()
						})
					}
				} else if(connectionType == "none"){
					that.logger.log(moduleName, 2, 'concluding MV Test, nothing is better than any other options here :)')
					/*
					* winner is none of the variants:
					* > if other original/variants are inputs or outputs de-wire them in the upstream / downstream spherons (including deleting any MV tests they are part of)
					* > if other variants are extInputs or extOutputs then this is a null test and not a supported usecase
					* > delete other port variants in this object
					* > delete all test data for whole spheron
					* > delete test object
					*/
					that.getConnectionTypeById(mvTestObject.original, function(originalConnectionType){
						if(originalConnectionType == "input"){
							/*
							* Delete the original upstream
							* then delete all instances of it in this spheron.
							* + data etc
							*/
							that.handleNoInputWon(mvTestObject, function(){
								callback()
							})
						} else if(originalConnectionType == "bias"){
							/*
							* Simply delete bias obejcts and test data.
							*/
							that.handleNoBiasWon(mvTestObject, function(){
								callback()
							})
						} else if(originalConnectionType == "output"){
							/*
							* Delete the original downstream
							* then delete all instances of it in this spheron.
							* + data etc
							*/
							that.handleNoOutputWon(mvTestObject, function(){
								callback()
							})

						} else {
							/*
							* The original connection type was external something.
							* Disconnecting this is just NOT a sane thing to do so lets delete the test.
							* delete the test and never mention this again :)
							*/
							that.spheron.deleteAllTestData(function(){
								that.spheron.deleteTestObject(mvTestObject, function(){
									callback()
								})
							})
						}
					})
				}
			})
		} else {
			callback()
		}
	},
	handleNoOutputWon: function(mvTestObject, callback){
		var that = this
		var arrayToDelete = []
		arrayToDelete.push(mvTestObject.original)
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != "none"){
				arrayToDelete.push(mvTestObject.variants[v])	
			}
		}
		that.updateDownstreamSpheron(mvTestObject.original, "none", function(){
			that.deleteConnectionsArrayById(arrayToDelete, function(){
				that.spheron.deleteAllTestData(function(){
					that.spheron.deleteTestObject(mvTestObject, function(){
						callback()
					})
				})
			})
		})
	},
	handleNoInputWon: function(mvTestObject, callback){
		var that = this
		var arrayToDelete = []
		arrayToDelete.push(mvTestObject.original)
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != "none"){
				arrayToDelete.push(mvTestObject.variants[v])	
			}
		}
		that.updateUpstreamSpheron(mvTestObject.original, "none", function(){
			that.deleteConnectionsArrayById(arrayToDelete, function(){
				that.spheron.deleteAllTestData(function(){
					that.spheron.deleteTestObject(mvTestObject, function(){
						callback()
					})
				})
			})
		})
	},
	handleNoBiasWon: function(mvTestObject, callback){
		var that = this
		var arrayToDelete = []
		arrayToDelete.push(mvTestObject.original)
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != "none"){
				arrayToDelete.push(mvTestObject.variants[v])	
			}
		}

		that.deleteConnectionsArrayById(arrayToDelete, function(){
			that.spheron.deleteAllTestData(function(){
				that.spheron.deleteTestObject(mvTestObject, function(){
					callback()
				})
			})
		})
	},
	handleVariantOutputWins: function(mvTestObject, result, callback){
		var arrayToDelete = []
		arrayToDelete.push(mvTestObject.original)
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != result.winner){
				arrayToDelete.push(mvTestObject.variants[v])
			}
		}

		that.updateDownstreamSpheron(mvTestObject.original, result.winner, function(){
			that.updateThisSpheronToId(mvTestObject.original, result.winner, function(){
				that.deleteConnectionsArrayById(arrayToDelete, function(){
					that.spheron.deleteAllTestData(function(){
						that.spheron.deleteTestObject(mvTestObject, function(){
							callback()
						})
					})
				})
			})
		})
	},
	handleVariantInputWins: function(mvTestObject, result, callback){
		var arrayToDelete = []
		arrayToDelete.push(mvTestObject.original)
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != result.winner){
				arrayToDelete.push(mvTestObject.variants[v])
			}
		}

		that.updateUpstreamSpheron(mvTestObject.original, result.winner, function(){
			that.updateThisSpheronFromId(mvTestObject.original, result.winner, function(){
				that.deleteConnectionsArrayById(arrayToDelete, function(){
					that.spheron.deleteAllTestData(function(){
						that.spheron.deleteTestObject(mvTestObject, function(){
							callback()
						})
					})
				})
			})
		})
	},
	updateThisSpheronFromId: function(originalId, newId, callback){
		var that=this
		that.spheron.updateThisSpheronFromId(originalId, newId, function(){
			callback()
		})
	},
	updateThisSpheronToId: function(originalId, newId, callback){
		var that=this
		that.spheron.updateThisSpheronToId(originalId, newId, function(){
			callback()
		})
	},
	updateDownstreamSpheron: function(originalConnectionId, newConnectionId, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running update downstream spheron')
		//find inputs upstream spheron
		that.getDownstreamSpheronByConnectionId(originalConnectionId, function(downstreamSpheronId){
			that.logger.log(moduleName, 2, 'downstream spheron is: ' + downstreamSpheronId)
			that.mongoUtils.updateSpheronInputConnectionBySpheronId(downstreamSpheronId, originalConnectionId, newConnectionId, function(){
				that.logger.log(moduleName, 2, 'downstream spheron updated. ')
				callback()
			})
		})
	},
	updateUpstreamSpheron: function(originalConnectionId, newConnectionId, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running update upstream spheron')
		//find inputs upstream spheron
		that.getUpstreamSpheronByConnectionId(originalConnectionId, function(upstreamSpheronId){
			that.logger.log(moduleName, 2, 'upstream spheron is: ' + upstreamSpheronId)
			//update the input to point at the winner
			that.mongoUtils.updateSpheronOutputConnectionBySpheronId(upstreamSpheronId, originalConnectionId, newConnectionId, function(){
				that.logger.log(moduleName, 2, 'upstream spheron updated. ')
				callback() 
			})
		})
	},
	handleBiasWon: function(mvTestObject, result, callback){
		var that = this
		var arrayToDelete = []
		if(result.winner != mvTestObject.original){
			arrayToDelete.push(mvTestObject.original)
		}
				
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != result.winner){
				arrayToDelete.push(mvTestObject.variants[v])
			}
		}

		that.deleteConnectionsArrayById(arrayToDelete, function(){
			that.spheron.deleteAllTestData(function(){
				that.spheron.deleteTestObject(mvTestObject, function(){
					callback()
				})
			})
		})
	},
	handleVariantExtOutputWins: function(mvTestObject, result, callback){
		var that = this
		var arrayToDelete = []
		arrayToDelete.push(mvTestObject.original)
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != result.winner){
				arrayToDelete.push(mvTestObject.variants[v])
			}
		}

		that.updateLessonOutputs(that.spheron.lessonId, that.spheron.spheronId, mvTestObject.original, result.winner, function(){
			that.deleteConnectionsArrayById(arrayToDelete, function(){
				that.spheron.deleteAllTestData(function(){
					that.spheron.deleteTestObject(mvTestObject, function(){
						callback()
					})
				})
			})	
		})
	},
	handleVariantExtInputWins: function(mvTestObject, result, callback){
		var that = this
		var arrayToDelete = []
		arrayToDelete.push(mvTestObject.original)
		for(var v=0;v<mvTestObject.variants.length;v++){
			if(mvTestObject.variants[v] != result.winner){
				arrayToDelete.push(mvTestObject.variants[v])
			}
		}

		that.logger.log(moduleName, 2, 'handling variant external input wins')
		that.logger.log(moduleName, 2, 'lessonId:' + that.spheron.lessonId)
		that.logger.log(moduleName, 2, 'spheronId:' + that.spheron.spheronId)
		that.logger.log(moduleName, 2, 'original connection:'+ mvTestObject.original)
		that.logger.log(moduleName, 2, 'winner:' + result.winner)

		//setTimeout(function(){
		that.updateLessonInputs(that.spheron.lessonId, that.spheron.spheronId, mvTestObject.original, result.winner, function(){
			that.deleteConnectionsArrayById(arrayToDelete, function(){
				that.spheron.deleteAllTestData(function(){
					that.spheron.deleteTestObject(mvTestObject, function(){
						callback()
					})
				})
			})	
		})	
		//}, 1000) s 

	},
	resetToOriginal: function(mvTestObject, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running reset to original.')
		that.logger.log(moduleName, 2, 'about to delete:' + mvTestObject.variants.join(','))
		that.deleteConnectionsArrayById(mvTestObject.variants, function(){
			that.spheron.deleteAllTestData(function(){
				that.logger.log(moduleName, 2, 'about to delete mvTestObject:' +JSON.stringify(mvTestObject))
				that.spheron.deleteTestObject(mvTestObject, function(){
					callback()
				})
			})
		})
	},
	updateLessonInputs: function(lessonId, spheronId, original, newInput, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running updateLessonInputs.')
		that.mongoUtils.updateLessonInputs(lessonId, spheronId, original, newInput, function(updatedLessonData){
			callback(updatedLessonData)
		})
	},
	updateLessonOutputs: function(lessonId, spheronId, original, newOutput, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running updateLessonInputs.')
		that.mongoUtils.updateLessonOutputs(lessonId, spheronId, original, newOutput, function(updatedLessonData){
			callback(updatedLessonData)
		})
	},
	getLesson: function(lessonId, callback){
		var that = this
		that.mongoUtils.getLessonDataByLessonId(lessonId, function(thisLesson){
			callback(thisLesson.lesson)
		})
	},
	deleteConnectionsArrayById: function(connectionsArray, callback){
		var that = this
		that.deleteConnectionsArrayByIdIterator(connectionsArray, 0, function(){
			callback()
		})
	},
	deleteConnectionsArrayByIdIterator: function(connectionsArray, idx, callback){
		var that = this
		if(connectionsArray[idx]){
			that.logger.log(moduleName, 2, 'about to delete:' + connectionsArray[idx])
			that.spheron.deleteConnectionById(connectionsArray[idx], function(){
				that.deleteConnectionsArrayByIdIterator(connectionsArray, idx+1, callback)
			})
		} else {
			callback()
		}
	},
	persistSpheron: function(callback){ 
		that = this
		that.mongoUtils.persistSpheron(that.spheron.spheronId, that.spheron, function(){
			callback()
		})
	}
}
 
module.exports = multivariateTestProcessor;
