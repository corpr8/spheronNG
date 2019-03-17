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
	config:{tdd: {tddTests: [],nextTestFile: "./tests/dataForSpheronNG/basicProblemDefinitionNG.json"}},
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
		fs.access(fileName, fs.F_OK, (err) => {
		  if (err) {
		    console.error(err)
		    callback(false)
		  }
		  callback(true)
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
				that.logger.log(moduleName, 2, 'too many items in the array: ' + thisItem.join(','))
				process.exitCode = 1
			} else {
				that.logger.log(moduleName, 2, 'finished : testOrderedArrayOfJSONObjectsIterator')
				callback()	
			}
		}
	},
	compareKeysAndValuesIterator: function(thisObject, expectedObject, idx, callback){
		var that = this

		that.logger.log(moduleName, 4, 'idx is: ' + idx + ' expected object: ' + JSON.stringify(expectedObject))
		that.logger.log(moduleName, 4, 'idx is: ' + idx + ' actual object: ' + JSON.stringify(thisObject))
		
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
							//that.logger.log(moduleName, 2, Object.keys(expectedObject)[idx])
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
			if(Object.keys(thisObject)[idx]){
				that.logger.log(moduleName, 2, 'object had too many keys: ' + JSON.stringify(thisObject))
				process.exitCode = 1
			} else {
				callback()	
			}
		}
	},
	handleTestResult: function(thisTest, result, resultIdx, testIdx, failureCount, callback){
		var that = this
		that.logger.log(moduleName, 2, ' handling test result')
		if(thisTest.returnType == "object"){
			that.isObject(result, function(isObject){
				if(isObject){
					if(thisTest.containsJSONArray == false){
						if(thisTest.ordered == true){
							//match the array, in order
							that.logger.log(moduleName, 2, ' expected: ' + thisTest.results + ' got: ' + result.join(','))
							if(result.join(',') == thisTest.results){
								that.logger.log(moduleName, 2, ' test passed')
							} else {
								that.logger.log(moduleName, 2, ' test failed')
								failureCount += 1
							}
							tdd.testIterator(testIdx, resultIdx +1, failureCount, callback)
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
								tdd.testIterator(testIdx, resultIdx +1, failureCount, callback)
							})
						}
					}
				} else {
					that.logger.log(moduleName, 2, ' test failed - not an object')
					process.exitCode = 1
				}
			})	
		} else if(thisTest.returnType == "string"){
			//we expect a string
			that.logger.log(moduleName, 2, ' TODO: handle string')
			process.exitCode = 1
		} else {
			that.logger.log(moduleName, 2, ' unhandled test case: failed')
			process.exitCode = 1
		}
	},
	loadModule: function(testIdx, failureCount, callback){
		var that = this

		that.logger.log(moduleName, 2, 'testIdx: ' + testIdx)
		asyncRequire(that.config.tdd.tddTests[testIdx].module).then(function(thisModule){
			that.logger.log(moduleName, 2, 'loaded module: ' + that.config.tdd.tddTests[testIdx].module)
			that.currentTestModule = thisModule
			if(that.config.tdd.tddTests[testIdx].input.type == "spheron"){
				that.spheron = null
				foundSpheronIdx = -1
				for(var v = 0;v<that.config.network.length;v++){
					if(that.config.network[v].spheronId == that.config.tdd.tddTests[testIdx].input.spheronId){
						foundSpheronIdx = v
					}
				}
				that.spheron = new Spheron(that.config.network[foundSpheronIdx], settings.logOptions) //note tdd is the spheron config also!!
											
				if(that.config.tdd.tddTests[testIdx].input.hasInitMethod){
					that.currentTestModule.init(that.spheron, that.logger, function(){
						that.logger.log(moduleName, 2, 'called back from init')
						//that.testIterator(testIdx, 0, failureCount, callback)
					})
				} else {
					//that.testIterator(testIdx, 0, failureCount, callback)
				}

				that.testIterator(testIdx, 0, failureCount, callback)
			} else {
				that.testIterator(testIdx, 0, failureCount, callback)
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
						var thisCallback = function(result){
							that.handleTestResult(thisTest, result, resultIdx, testIdx, failureCount, callback)
						}
						theseParameters.push(thisCallback)
						that.currentTestModule[thisTest.function](...theseParameters)
					} else {
						// no parameters so just have a callback
						that.currentTestModule[thisTest.function](function(result){
							that.handleTestResult(thisTest, result, resultIdx, testIdx, failureCount, callback)	
						})
					}
				} else {
					that.logger.log(moduleName, 2, 'Function: ' + thisTest.function + ' does not exist. Test failed.')
					failureCount += 1
					that.testIterator(testIdx, resultIdx +1, failureCount, callback)
				}
			} else {
				/*
				* TODO: in this scenario, we should load the module and pass the init data again...  
				*/
				testIdx += 1
				if(that.config.tdd.tddTests[testIdx]){
					that.loadModule(testIdx, failureCount, callback)
				} else {
					/*
					* check load next file
					*/
					that.checkLoadNextFile(failureCount, callback)
				}
				//that.testIterator(testIdx +1, 0, failureCount, callback)
			}
		} else {
			that.checkLoadNextFile(failureCount, callback)
		}
	},
	checkLoadNextFile: function(failureCount, callback){
		var that = this
		if(that.config.tdd.nextTestFile){
			testIdx = 0
			resultIdx = 0
			if(that.config.tdd.nextTestFile){
				that.fileExists(that.config.tdd.nextTestFile, function(exists){
					if(exists){
						that.isPreviousTestIterator(that.config.tdd.nextTestFile, 0, function(isPreviousTest){
						if(isPreviousTest){
							that.logger.log(moduleName, 2, 'We have already run test: ' + that.config.tdd.nextTestFile + '. Exiting.')
								//process.exitCode = 1
								callback(failureCount+1)
							} else {
							that.previousTests.push(that.config.tdd.nextTestFile)
							that.config = JSON.parse(fs.readFileSync(that.config.tdd.nextTestFile, 'utf8'))
							
							that.loadModule(testIdx, failureCount, callback)
							}
						})
					} else {
						that.logger.log(moduleName, 2, 'next test document does not exist.')
						//process.exitCode = 1
						callback(failureCount+1)
					}
				})
			} else {
				callback(failureCount)
			}
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