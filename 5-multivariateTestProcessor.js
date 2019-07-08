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
		//iterate through each test and see if we have the required data to terminate it.
		//Note: we might have multiple 'paths' of applicable data. If so, we are searching for a complete set with a consistent path. 
		that.logger.log(moduleName, 2, 'running test iterator - BackProp MV test resolution.') 
		process.exitCode = 1
	},
	getCompletedTestsByIoName: function(ioName, testLength, callback){
 		var that = this
 		that.getCompletedTestsByIoNameIterator(ioName, 0, -1, 0, testLength, {}, function(completedTestsObject){
 			callback(completedTestsObject)
 		})
	},
	getCompletedTestsByIoNameIterator: function(ioName, ioIdx, testIdx, testsIdx, testLength, completedTestsObject, callback){
		var that = this
		if(that.spheron.io[ioIdx]){
			if(that.spheron.io[ioIdx].id == ioName){
				//ok so we are in the correct connection - however, we need to iterate over every test object in this io
				//testIdx - checks inside an individual test so we need another iterator
				//let there be testsIdx
				if(that.spheron.io[ioIdx].errorMap[testsIdx]){
					if(testIdx < testLength){
						//ok so lets check if each test object exists????

					} else {

					}
				} else {
					that.getCompletedTestsByIoNameIterator(ioName, ioIdx+1, 0, testsIdx+1, testLength, completedTestsObject, callback)
				}

				
			} else {
				that.getCompletedTestsByIoNameIterator(ioName, ioIdx+1, testIdx, testsIdx, testLength, completedTestsObject, callback)
			}
		} else {
			callback(completedTestsObject)
		}
	},
	getLessonLength: function(lessonId, callback){ 
		var that = this
		that.logger.log(moduleName, 2, 'running get lesson length')
		//callback(4)
		
		that.mongoUtils.getLessonLength(lessonId, function(lessonLength){
			callback(lessonLength)
		}) 
		 
	},
	getErrorMapByIoName: function(ioName, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running get lesson length')
		that.getErrorMapByIoNameIterator(ioName, 0, function(lessonLength){
			callback(lessonLength)
		})
	},
	getErrorMapByIoNameIterator: function(ioName, ioIdx, callback){
		var that = this
		if(that.spheron.io[ioIdx]){
			if(that.spheron.io[ioIdx].id == ioName){
				callback(that.spheron.io[ioIdx].errorMap)
			} else {
				that.getErrorMapByIoNameIterator(ioName, ioIdx+1, callback)
			}
		} else {
			callback(null)
		}
	}
}
 
module.exports = multivariateTestProcessor;
