var moduleName = 'whatIsAnd'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var asyncRequire = require('async-require');

/*
* Module which supports the lesson: whatIsAnd:
* > Provides functions which are called when the data fills the syncOutput group - which in this case is a single output
* So, check the result and back propagate (if in training mode), then fire the next lesson to the inputs
* > lessonInit - fire first lesson into the network.
*
*/ 

var whatIsAnd = {
	logger: null, 
	mongoUtils: null,
	commonFunctions: null,
	init: function(mode, logger, mongoUtils, callback){
		var that = this
		that.logger = logger
		that.logger.log(moduleName, 2,'init')
			
		if(!mode){
			that.mongoUtils = mongoUtils
			asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
				that.commonFunctions = thisCommonFunctions
				that.commonFunctions.init(that.logger, that.mongoUtils, function(){
					that.logger.log(moduleName, 2, 'Module running in Production mode')
					callback(that.spheron)
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
						that.commonFunctions.init(that.logger, that.mongoUtils, function(){
							callback()
						})
					})
				})
			})
		}
	},
	lessonInit: function(callback){
		/*
		* TODO
		*/
	},
	whatIsAndOutputFunction: function(){
		/*
		* TODO
		*/
	}
}
module.exports = whatIsAnd;
