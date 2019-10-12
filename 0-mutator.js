var moduleName = 'mutator'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var multivariator = require(appDir +'/multivariator.js')
var asyncRequire = require('async-require');

/*
* Module to mutate a spheron
*/ 

var mutator = {
	spheron: null,
	logger: null,
	commonFunctions: null,
	mongoUtils: null,
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
					that.mutate(function(){
						//eventually - persist spheron
						that.mongoUtils.persistSpheron(that.spheron.spheronId, that.spheron, function(){
							callback(that.spheron)	
						})
					})
				})
			})
		} else {
			asyncRequire('./mongoUtils').then(function(thisModule){
				that.mongoUtils = thisModule
				that.spheron.init(that.logger, function(){  //is this really needed???
					asyncRequire('./commonFunctions').then(function(thisCommonFunctions){
						that.commonFunctions = thisCommonFunctions
						that.commonFunctions.init(that.logger, that.mongoUtils, that.spheron, function(){
							that.logger.log(moduleName, 2, 'Module running in TDD mode')
							/*
							* Note: we don't call mutate so that the TDD harness can do this manually.
							*/
					 		callback() 
					 	})
					})
				})
			}) 
		}
	},
	mutate: function(callback){
		var that = this
		var mutation = Math.floor(Math.random() *2)

		switch(mutation) {
			case 0:
				that.logger.log(moduleName, 2,'running mutation: tweak connection')
				/*
				* tweak connection - copy a connection and create a variant map
				* alter its angle very slightly... (up to 5degrees?)
				* Careful to use minimum .01 degree
				*/

				//TODO:

				//eventually
				callback()
			break;
			default:
				that.logger.log(moduleName, 2,'/* TODO: Mutation case not handled as yet. Please code. */')
				callback()
			break;
		}
	}

}

module.exports = mutator;
