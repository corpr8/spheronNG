var moduleName = 'runner'
var settings = require('./settings.json')
var Logger = require('./logger.js')
var logger;
var mongoUtils = require('./mongoUtils.js')
var Spheron = require('./spheron.js')

var tdd = {
	currentTestModule: null,
	thisSpheron: null,
	thisSpheronConfig: null,
	program: {
		nextSchedule: "./file for the next set of tests.json",
		tests: [
			{
				"module": "./myModule.js",
				"input": {
					"hasInitMethod" : true,
					"type": "spheron",
					"config" : "./tests/tdd/inputData.json"
				},
				"expectedResults" : [
					{
						"function" : "thisFunction",
						"parameters" : ["some specific parameters"],
						"results":[["results array"],["results array"],["results array"]]
					},
					{
						"function" : "thisFunction1",
						"parameters" : ["some specific parameters"],
						"results":[["results array"],["results array"],["results array"]]
					}
				]
			},
			{
				"module": "./myModule1.js",
				"input": {
					"type": "spheron",
					"config" : "./tests/tdd/inputData.json"
				},
				"expectedResults" : [ "note these should be embedded in the definition document..." ]
			}
		]
	},
	testIterator: function(testIdx, failureCount, callback){
		failureCount = (failureCount) ? failureCount : 0
		testIdx = (testIdx) ? testIdx : 0
		var that = this
		if(testIdx == 0){
			if(that.program.tests.input.type == "spheron"){
				that.thisSpheronConfig = require(that.program.tests.input.config)
				that.spheron = null
				that.spheron = new Spheron(that.thisSpheronConfig, settings.logOptions)
			}

			that.currentTestModule = null
			that.currentTestModule = require(that.program.tests.module)
			if(that.program.tests.input.hasInitMethod == true){


			}


		}
		if(that.program.tests.expectedResults[testIdx]){
			var thisTest = that.program.tests.expectedResults[testIdx]

			//run the function...
			//call the function, examine the output and determine errors, increment count.
			that.currentTestModule[thisTest.function](thisTest.parameters)

			/*
			* Shold we listen to the output, or should we listen to logger in a special mode???
			*/
			

		} else {
			callback(failureCount)
		}
	}
	init: function(){
		var that = this
		that.testIterator(0, 0 function(failureCount){
			if(failureCount == 0){
				console.log('we passed all tests')
				callback()
			} else{
				throw('we failed: ' + failureCount + 'tests.')	
			}
		})
	}
}

tdd.init(function(){
	//normally we would load the testSchedule - however, we are preseeding it for now.
})