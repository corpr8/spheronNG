var moduleName = 'tdd'
var settings = require('./settings.json')
var Logger = require('./logger.js')
var mongoUtils = require('./mongoUtils.js')
var Spheron = require('./spheron.js')
var asyncRequire = require('async-require');
var fs = require('fs');

var tdd = {
	currentTestModule: null,
	thisSpheron: null,
	logger: null,
	config:{tdd: {tddTests: [],nextTestFile: "./tests/dataForSpheronNG/0-basicProblemDefinitionNG.json"}},
	previousTests: [],
	isPreviousTestIterator: function(testName, idx, callback){
		idx = (idx) ? idx : 0
		var that = this
		if(that.previousTests[idx]){
			if(testName == that.previousTests[idx]){
				callback(true)
			} else {
				that.isPreviousTestIterator(testName, idx +1, callback)
			}
		} else {
			callback(false)
		}
	},
	fileExists: function(fileName, callback){
		var that = this
		that.logger.log(moduleName, 4, 'in fileExists function for: ' + fileName)
		fs.access(fileName, fs.F_OK, (err) => {
			if (err) {
				//that.logger.log(moduleName, 2, 'does not exist')
				callback(false)
			} else {
				//that.logger.log(moduleName, 2, 'does exist')
				callback(true)
			}
		})
	},
	isObject: function(testItem, callback){
		callback((typeof testItem == "object") ? true : false)
	},
	isArray: function(testItem, callback){
		callback(Array.isArray(testItem) ? true : false)
	},
	isString: function(testItem, callback){
		callback((typeof testItem == "string") ? true : false)
	},
	isNumber: function(testItem, callback){
		callback((typeof testItem == "number") ? true : false)
	},
	testOrderedArrayOfJSONObjects: function(testItem, expectedResults, callback){
		var that = this
		that.isArray(testItem, function(isArray){
			if(isArray){
				that.testOrderedArrayOfJSONObjectsIterator(testItem, expectedResults, 0, function(result){
					callback()
				})
			} else {
				that.logger.log(moduleName, 2, ' was not an array. test Failed.')		
				process.exitCode = 1
			}
		})
	},
	testOrderedArrayOfJSONObjectsIterator: function(testItem, expectedResults, idx, callback){
		var that = this
		if(expectedResults[idx]){
			that.isObject(expectedResults[idx], function(isObject){
				if(isObject){
					that.logger.log(moduleName, 4, 'testing keys and values for this object: ' + JSON.stringify(testItem[idx]))
					that.compareKeysAndValuesIterator(testItem[idx], expectedResults[idx], 0, function(){
						that.testOrderedArrayOfJSONObjectsIterator(testItem, expectedResults, idx +1, callback)
					})
				} else {
					that.logger.log(moduleName, 2, 'test failed - array item is not an Object')
					process.exitCode = 1
				}
			})
		} else {
			if(testItem[idx]){
				that.logger.log(moduleName, 2, 'too many items in the array: ' + testItem.join(',') + ' versus: ' + expectedResults.join(','))
				process.exitCode = 1
			} else {
				that.logger.log(moduleName, 4, 'finished : testOrderedArrayOfJSONObjectsIterator')
				callback()	
			}
		}
	},
	compareKeysAndValuesIterator: function(thisObject, expectedObject, idx, callback){
		var that = this

		that.logger.log(moduleName, 4, 'idx is: ' + idx + ' expected object: ' + JSON.stringify(expectedObject))
		that.logger.log(moduleName, 4, 'idx is: ' + idx + ' actual object: ' + JSON.stringify(thisObject))
		
		if(thisObject){
			if(Object.keys(expectedObject)[idx]){
				//compare the keys
				if(Object.keys(expectedObject)[idx] == Object.keys(thisObject)[idx]){
					var thisKeyExpectedValue = expectedObject[Object.keys(expectedObject)[idx]]
					var thisKeyActualValue = thisObject[Object.keys(thisObject)[idx]]
					that.isArray(thisKeyExpectedValue, function(isArray){
						if(isArray){
							//however, as our test data is an embedded array, we need to iterate the array and basically do this whole thing again...
							that.testOrderedArrayOfJSONObjects(thisKeyActualValue, thisKeyExpectedValue, function(){
								that.compareKeysAndValuesIterator(thisObject, expectedObject, idx+1, callback)
							})
						} else {
							if(thisKeyExpectedValue == thisKeyActualValue){
								that.compareKeysAndValuesIterator(thisObject, expectedObject, idx+1, callback)
							} else {
								that.logger.log(moduleName, 2, 'key values do not match: ' + expectedObject[Object.keys(expectedObject)[idx]] + ' : ' + thisObject[Object.keys(thisObject)[idx]])
								that.logger.log(moduleName, 2, 'expected object: ' + JSON.stringify(expectedObject))
								that.logger.log(moduleName, 2, 'actual object: ' + JSON.stringify(thisObject))
								process.exitCode = 1
							}
						}
					})
				} else {
					that.logger.log(moduleName, 2, 'key names do not match: ' + Object.keys(expectedObject)[idx] + ' : ' + Object.keys(thisObject)[idx])
					process.exitCode = 1
				}
			} else {
				if(Object.keys(thisObject).length != Object.keys(thisObject).length){
					that.logger.log(moduleName, 2, 'idx is: ' + idx + ' expected object: ' + JSON.stringify(expectedObject) + ' object keys length: ' + Object.keys(thisObject).length)
					that.logger.log(moduleName, 2, 'idx is: ' + idx + ' actual object: ' + JSON.stringify(thisObject)  + ' object keys length: ' + Object.keys(thisObject).length)
					that.logger.log(moduleName, 2, 'object had too many keys: ' + JSON.stringify(thisObject))
					process.exitCode = 1
				} else {
					callback()
				}
			}
		} else {
			that.logger.log(moduleName, 2, 'idx is: ' + idx + ' expected object: ' + JSON.stringify(expectedObject))
			that.logger.log(moduleName, 2, 'idx is: ' + idx + ' actual object: ' + JSON.stringify(thisObject))
			that.logger.log(moduleName, 2, 'cannot compare object and key as object is null. failed.')
			process.exitCode = 1
		}
	}, 
	handleTestResult: function(thisTest, result, resultIdx, testIdx, failureCount, callback){
		var that = this
		that.logger.log(moduleName, 2, 'handling test result')
		if(thisTest.returnType == "object"){
			that.isObject(result, function(isObject){
				if(isObject){
					if(thisTest.containsJSONArray == false){
						if(thisTest.ordered == true){
							//match the array, in order
							that.logger.log(moduleName, 4, 'expected: ' + thisTest.results + ' got: ' + result.join(','))
							if(result.join(',') == thisTest.results){
								that.logger.log(moduleName, 2, 'test passed')
								tdd.testIterator(testIdx, resultIdx +1, failureCount, callback)
							} else {
								that.logger.log(moduleName, 2, 'ordered array test failed.')
								process.exitCode = 1 
							}
						} else {
							that.logger.log(moduleName, 2, 'TODO: handle unordered array...')
							process.exitCode = 1
						}		
					} else {
						if(thisTest.ordered == false){
							that.logger.log(moduleName, 2, 'TODO: handle unordered json array (a search for all things)...')
							process.exitCode = 1
						} else {
							that.logger.log(moduleName, 2, 'handle ordered json array (direct match)...')
							that.testOrderedArrayOfJSONObjects(result, thisTest.results, function(){
								that.logger.log(moduleName, 2, 'array handled...')
								tdd.testIterator(testIdx, resultIdx +1, failureCount, callback)
							})
						}
					}
				} else {
					that.logger.log(moduleName, 2, 'test failed - not an object')
					process.exitCode = 1
				}
			})	
		} else if(thisTest.returnType == "string"){
			//we expect a string
			that.logger.log(moduleName, 2, 'TODO: handle string - failed')
			process.exitCode = 1
		} else if(thisTest.returnType == null){
			if(result == null){
				that.logger.log(moduleName, 2, 'returned null - test passed')
				tdd.testIterator(testIdx, resultIdx +1, failureCount, callback)
			} else {
				that.logger.log(moduleName, 2, 'expected a null result. test failed.')
				process.exitCode = 1 
			}
		} else {
			that.logger.log(moduleName, 2, 'TODO: unhandled test case - failed')
			process.exitCode = 1
		}
	},
	loadModule: function(testIdx, failureCount, callback){
		var that = this

		that.logger.log(moduleName, 2, 'testIdx: ' + testIdx)
		that.logger.log(moduleName, 2, 'about to try and load: ' + that.config.tdd.tddTests[testIdx].module)
		that.fileExists(that.config.tdd.tddTests[testIdx].module + '.js', function(fileExists){
			if(fileExists){
				that.logger.log(moduleName, 2, that.config.tdd.tddTests[testIdx].module + ' exists')
				asyncRequire(that.config.tdd.tddTests[testIdx].module).then(function(thisModule){
					that.logger.log(moduleName, 2, 'loaded module: ' + that.config.tdd.tddTests[testIdx].module)
					that.currentTestModule = thisModule
					if(that.config.tdd.tddTests[testIdx].input.type == "spheron"){
						that.logger.log(moduleName, 4, 'Searching document for spheron definition for: ' + that.config.tdd.tddTests[testIdx].input.spheronId)
						that.spheron = null
						foundSpheronIdx = -1
						for(var v = 0;v<that.config.network.length;v++){
							if(that.config.network[v].spheronId == that.config.tdd.tddTests[testIdx].input.spheronId){
								foundSpheronIdx = v
							}
						}
						if(foundSpheronIdx != -1){
							that.spheron = new Spheron(that.config.network[foundSpheronIdx], settings.logOptions) //note tdd config document is the spheron config also!!
							if(that.config.tdd.tddTests[testIdx].input.hasInitMethod){
								that.logger.log(moduleName, 2, 'calling init on a spheron')
								that.spheron.tdd = 'tdd'
								that.currentTestModule.init(that.spheron, that.logger, function(){
									that.logger.log(moduleName, 2, 'called back from init')
									that.testIterator(testIdx, 0, failureCount, callback)
								})
							} else {
								that.testIterator(testIdx, 0, failureCount, callback)
							}
						} else {
							that.logger.log(moduleName, 2, 'Spheron definition not found in testfile for spheron: ' + that.config.tdd.tddTests[testIdx].input.spheronId + ' - failed')
							process.exitCode = 1
						}
						
					} else if(that.config.tdd.tddTests[testIdx].input.type == "dumbModule"){
						that.logger.log(moduleName, 2, 'calling init on a dumb module')
						that.currentTestModule.init(that.logger, function(){
							that.logger.log(moduleName, 2, 'called back from init')
							that.testIterator(testIdx, 0, failureCount, callback)
						})
					} else {
						that.testIterator(testIdx, 0, failureCount, callback)
					}
				})
			} else {
				that.logger.log(moduleName, 2, 'Module does not exist: ' + that.config.tdd.tddTests[testIdx].module + ' - failed')
				process.exitCode = 1
			}
		})	
	},
	testIterator: function(testIdx, resultIdx, failureCount, callback){
		var that = this
		failureCount = (failureCount) ? failureCount : 0
		testIdx = (testIdx) ? testIdx : 0
		resultIdx = (resultIdx) ? resultIdx : 0
		if(that.config.tdd.tddTests[testIdx]){
			if(that.config.tdd.tddTests[testIdx].expectedResults[resultIdx]){
				that.logger.log(moduleName, 2, 'testIdx: ' + testIdx + ' resultIdx:' + resultIdx)
				var thisTest = that.config.tdd.tddTests[testIdx].expectedResults[resultIdx]
				that.logger.log(moduleName, 2, 'test function: ' + thisTest.function)
				if(that.currentTestModule[thisTest.function]){
					if(thisTest.parameters){
						//build and apply an array of parameters to the function
						var theseParameters = thisTest.parameters
						that.logger.log(moduleName, 2, 'parameters: ' + theseParameters)
						that.logger.log(moduleName, 2, 'parameter length: ' + theseParameters.length)

						var thisCallback = function(result){
							that.handleTestResult(thisTest, result, resultIdx, testIdx, failureCount, callback)
						}

						/*
						* Note: The ... below means that we wrap parameters in an extra [] as they are unpacked by the ... in the test here!!!
						*/

						theseParameters.push(thisCallback)
						that.currentTestModule[thisTest.function](...theseParameters)

					} else {
						// no parameters so just have a callback
						that.logger.log(moduleName, 2, 'no parameters!!!')
						that.currentTestModule[thisTest.function](function(result){
							that.handleTestResult(thisTest, result, resultIdx, testIdx, failureCount, callback)	
						})
					}
				} else {
					that.logger.log(moduleName, 2, 'Function: ' + thisTest.function + ' does not exist. Test failed.')
					process.exitCode = 1
				}
			} else {
				/* TODO: in this scenario, we should load the module and pass the init data again... */
				testIdx += 1
				if(that.config.tdd.tddTests[testIdx]){
					that.loadModule(testIdx, failureCount, callback)
				} else {
					that.checkLoadNextFile(failureCount, callback)
				}
			}
		} else {
			that.checkLoadNextFile(failureCount, callback)
		}
	},
	checkLoadNextFile: function(failureCount, callback){
		var that = this
		if(that.config.tdd.nextTestFile){
			that.logger.log(moduleName, 2, 'Trying to load: ' + that.config.tdd.nextTestFile)
			testIdx = 0
			resultIdx = 0
			that.fileExists(that.config.tdd.nextTestFile, function(fileExists){
				if(fileExists){
					that.logger.log(moduleName, 4, that.config.tdd.nextTestFile + ' exists.')
					that.isPreviousTestIterator(that.config.tdd.nextTestFile, 0, function(isPreviousTest){
						if(isPreviousTest){
							that.logger.log(moduleName, 2, 'We have already run test: ' + that.config.tdd.nextTestFile + '. Failed.')
							process.exitCode = 1
						} else {
							that.previousTests.push(that.config.tdd.nextTestFile)
							that.logger.log(moduleName, 2, 'Loading testfile: ' + that.config.tdd.nextTestFile)
							try{
								that.config = JSON.parse(fs.readFileSync(that.config.tdd.nextTestFile, 'utf8'))
								that.loadModule(testIdx, failureCount, callback)	
							} catch(err) {
								that.logger.log(moduleName, 2, 'Invalid JSON in file: ' + that.config.tdd.nextTestFile + '. Failed.')
								process.exitCode =1
							}
						}
					})
				} else {
					that.logger.log(moduleName, 2, that.config.tdd.nextTestFile + ' does not exist. Failed.')
					process.exitCode = 1
				}
			})
		} else {
			callback(failureCount)
		}
	},
	init: function(){
		var that = this
		that.logger = (that.logger) ? that.logger : new Logger(settings.logOptions)
		that.testIterator(0, 0, 0, function(failureCount){
			if(failureCount == 0){
				that.logger.log(moduleName, 2, 'we passed all test(\'s)\r\n-----------------------\r\n---- exiting tdd ------\r\n-----------------------')
				process.exitCode = 0
			} else{
				that.logger.log(moduleName, 2, 'we failed: ' + failureCount + ' test(\'s)')
				process.exitCode = 1
			}
		})
	}
}

tdd.init(function(){
	//normally we would load the testSchedule - however, we are preseeding it in the config variable.
})