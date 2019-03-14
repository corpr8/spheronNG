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
					var theseParameters = thisTest.parameters
					var thisCallback = function(result){
						that.logger.log(moduleName, 2, 'test type: ' + (typeof thisTest.results) +  ' result Type: ' + (typeof result))
						that.logger.log(moduleName, 2, 'we expected: ' + thisTest.results +  ' and we got: ' + result)
						if(result.join(',') == thisTest.results){
							that.logger.log(moduleName, 2, ' test passed')
						} else {
							that.logger.log(moduleName, 2, ' test failed')
							failureCount += 1
						}
						tdd.testIterator(testIdx, resultIdx +1, failureCount, callback)
					}
					theseParameters.push(thisCallback)

					that.currentTestModule[thisTest.function](...theseParameters)
				} else {
					that.logger.log(moduleName, 2, 'Non-existent function, test failed')
					failureCount += 1
					that.testIterator(testIdx, resultIdx +1, failureCount, callback)
				}
			} else {
				that.testIterator(testIdx +1, 0, failureCount, callback)
			}
		} else {
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
									asyncRequire(that.config.tdd.tddTests[testIdx].module).then(function(thisModule){
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
	//normally we would load the testSchedule - however, we are preseeding it for now.
})