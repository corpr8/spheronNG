var moduleName = 'commonFunctions'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');

/*
* As it says...
*/

var commonFunctions = {
	logger: null, 
	mongoUtils: null,
	spheron: null,
	init: function(logger, mongoUtils, spheron, callback){
		var that = this
		that.logger = logger
		if(mongoUtils){
			that.mongoUtils = mongoUtils	
		}
		
		that.logger.log(moduleName, 2,'init')
		
		if(spheron){
			that.spheron = spheron
		}
		callback()			
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
	getConnectionsBySpheronId: function(spheronId, callback){
		var that = this
		that.mongoUtils.getConnectionsBySpheronId(spheronId, function(connections){
			callback(connections)
		})
	}, 
	getVariantsBySpheronId: function(spheronId, callback){
		var that = this
		that.mongoUtils.getVariantsBySpheronId(spheronId, function(variants){
			callback(variants)
		})
	},
	getInputQueueBySpheronId: function(spheronId, callback){
		var that = this
		that.mongoUtils.getSpheron(spheronId, function(thisSpheron){
			that.logger.log(moduleName, 2, 'running getInputQueueBySpheronId')
			callback(thisSpheron.inputMessageQueue)
		})
	},
	getLessonState: function(lessonId, callback){
		var that = this
		that.mongoUtils.getLessonState(lessonId, function(thisState){
			that.logger.log(moduleName, 2, 'running get lesson state')
			callback(thisState)
		})
	},
	getPropogationMessageQueue: function(callback){
		var that = this
		that.spheron.getPropagationMessageQueue(function(propagationMessageQueue){
			that.logger.log(moduleName, 2, 'propagationMessageQueue is: ' + JSON.stringify(propagationMessageQueue))
			callback(propagationMessageQueue)
		})
	},
	getPropogationMessageQueueBySpheronId: function(spheronId, callback){
		var that = this
		that.mongoUtils.getPropagationMessageQueueBySpheronId(spheronId, function(propagationMessageQueue){
			that.logger.log(moduleName, 2, 'propagationMessageQueue is: ' + JSON.stringify(propagationMessageQueue))
			callback(propagationMessageQueue)
		})
	}
}
module.exports = commonFunctions;
