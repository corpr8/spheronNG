var moduleName = 'backpropQueueProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Module to handle propogating messages from the propagation queue
*/ 

var backpropQueueProcessor = {
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

				/*
				* TODO: 
				* 1: Take backprop messages from the queue, 
				* 2: Decompose their path as they pass across the spheron, 
				* 3: Write the error values into the variant register
				* 4: push the resultant backprop messages into the upstream spherons queues IF there is still a path.
				*/

				that.logger.log(moduleName, 2, 'Running Phase 0: iterating the backpropQueue')
				that.iterateBackpropQueue(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				default:
				/*any post processing and callback*/
				that.logger.log(moduleName, 2, 'Calling back from ' + moduleName + ' to main runner')
				callback()
			break;
		}
	}
}

module.exports = backpropQueueProcessor;
