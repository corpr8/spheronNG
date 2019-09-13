var moduleName = 'networkMaintenanceProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');

/*
* Network mainenance.
* If the life of a connection within a spheron has fallen below the static threshold,
* Turn it into a bias.
* Cancel any A/B tests it is part of
* Splat test data
* also remove any connections too the now bias.
*/ 

var networkMaintenanceProcessor = {
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

				that.logger.log(moduleName, 2, 'Running Phase 0: running petrifier')
				that.petrifier(0.0001, function(){
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
	getLessonPetrificationThreshold: function(lessonId, callback){
		var that = this
		that.logger.log(moduleName, 2,'getting lesson petrification threshold')
		that.mongoUtils.getLessonPetrificationThresholdById(lessonId, function(petrificationThreshold){
			callback(petrificationThreshold)
		})
	},
	petrifier: function(petrificationThreshold, callback){
		var that = this
		that.logger.log(moduleName, 2,'running petrifier')
		that.petrificationIterator(petrificationThreshold, 0, function(){
			that.logger.log(moduleName, 2,'finished running petrifier')
			callback()
		})
	},
	petrificationIterator: function(petrificationThreshold, idx, callback){
		//any input connections whose life values are less than the petrification threshold should be converted to biases.
		//we should disconnect any upstream connections (if they exist)
		//we should also get rid of any A/B tests (involving this connection both here and upstream)
		var that = this
		if(that.spheron.io[idx]){
			if(that.spheron.io[idx].life){
				if(that.spheron.io[idx].life <= petrificationThreshold){
					that.logger.log(moduleName, 2,'we found a connection to petrify: ' + that.spheron.io[idx].id)
					//ok lets petrify this connection - TODO: Tests...
					that.mongoUtils.deleteConnectionFromUpstreamSpheronBySpheronId(that.spheron.io[idx].fromId, that.spheron.io[idx].fromPort, function(){
						that.logger.log(moduleName, 2,'called back from sorting out upstream spheron: ' + that.spheron.io[idx].fromPort)
						/*
						* TODO: 
						* Delete A/B tests containing this connection
						* Delete test Data containing this connection
						* Convert this connection to a bias...
						*/

						that.spheron.findTestsContainingConnectionIdAndRemove(that.spheron.io[idx].id, function(){
							that.spheron.deleteAllTestData(function(){
								that.spheron.convertConnectionToBiasById(that.spheron.io[idx].id, function(){
									that.petrificationIterator(petrificationThreshold, idx+1, callback)	
								})
							})
						})
					})
				} else {
					that.petrificationIterator(petrificationThreshold, idx+1, callback)	
				}
			} else {
				that.petrificationIterator(petrificationThreshold, idx+1, callback)
			}
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
module.exports = networkMaintenanceProcessor;
