var moduleName = 'mongoUtils'
//var logger;
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir + '/settings.json')
var generateUUID = require(appDir + '/generateUUID.js');
var mongo = require('mongodb');
var fs = require('fs');
var asyncRequire = require('async-require');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID; 
//var url = "mongodb://127.0.0.1:27017/"; //if running locally on network.
var url = "mongodb://192.168.61.1:27017/"; //if running locally on macbook with alias set up.
var db = [];
var dbo = [];
var mongoNet = [];

/*
* A way to persist Spherons and connections out to mongo
*/ 

var mongoUtils = {
	logger : null,
	init: function(logger, callback){
		var that = this
		that.logger = logger 
		that.logger.log(moduleName, 2, 'Firing init')
		MongoClient.connect(url, { useNewUrlParser: true }, function(err, thisDb) {
			db = thisDb
			if (err) throw err;
			dbo = db.db("myBrain");
			mongoNet = dbo.collection("brain")
			that.logger.log(4,'Connected to Mongo')
			callback()
		});
	},
	closeDb: function(){ 
		db.close()
		return
	},
	initTick:function(callback){
		var that = this
		mongoNet.insertOne({
			tick:"tock",
			globalTick: 0
		}, function(err,res){	
			if(err){ 
				throw err
			} else { 
				that.logger.log(4,'inserted tick')
				callback()
			}
		})		
	},
	dropDb: function(callback){
		var that = this
		mongoNet.drop()
		that.logger.log(4,'dropped old database')
		callback()
	},
	find: function(callback){
		mongoNet.find({}).toArray(function(err, result) {
	    	if (err) throw err;
	    	callback(result)
		});
	}, 
	getSpheron: function(id, callback){
		mongoNet.findOne({
			type: "spheron",
			spheronId: id
		}, function(err, result) {
	    	if (err) throw err;
	    	callback(result)
		});
	},
	getLessonModeById: function(lessonId, callback){
		mongoNet.findOne({
			type: "lesson",
			problemId: lessonId
		}, function(err, result) {
	    	if (err){
	    		callback();
	    	} else {	
	    		callback(result.options.mode)
	    	}
		});
	},
	getLessonTestAnswer: function(lessonId, testIdx, callback){
		var that = this
		if(!lessonId) throw 'no lessonId supplied'
		if(!testIdx) throw 'no testIdx supplied'
		mongoNet.findOne({
			type: "lesson",
			problemId: lessonId
		}, function(err, results) {
	    	if (err){
	    		callback();
	    	} else {
	    		that.logger.log(3,'lesson data: ' + results.tests[testIdx])
	    		callback(results.tests[testIdx].outputs)
	    	}
		});
	},
	getLessonLength: function(lessonId, callback){
		mongoNet.findOne({
			type: "lesson",
			problemId: lessonId
		}, function(err, results) {
	    	if (err){
	    		callback();
	    	} else {	
	    		callback(results.tests.length)
	    	}
		});
	},
	assessIfLessonPassed(problemId, lowestFound, callback){
		mongoNet.findOne({
			type: "lesson",
			problemId: problemId
		}, function(err, results) {
	    	if (err){
	    		callback();
	    	} else {	
	    		if(lowestFound < results.options.errorThreshold){
					mongoNet.findOneAndUpdate({
						type: "lesson",
						problemId: problemId
					},{
						$set: {mode:"trained"}
					}, 
					{}, 
					function(err,doc){
						if(err){
							callback()
						} else { 
							callback('trained')
						}	
					})
	    		} else {
	    			callback()
	    		}
	    	}
		});
	},
	deleteSpheron: function(id, callback){
		var that = this
		/*
		* TODO: We should make sure that deleting a spheron is safe - i.e. there are no connection objects pointing at or from it.
		*/
		try {
			mongoNet.deleteOne({
				type: "spheron", 
				id : id 
			});
			callback()
		} catch (e) {
			that.logger.log(4,'bad delete: ' + e)
			throw(e);
		}
	},
	deleteConnection: function(connectionId, callback){
		/*
		* 
		*/
	},
	dropCollection: function(callback){ 
		var that = this
		mongoNet.drop()
		that.logger.log(4,'Collection dropped')
		callback()
	},
	setupDemoDataFromFile: function(fileName, callback){
		/*
		* Use this from the TDD framework to load a specific network - i.e. typically the current document (by file name)
		*/

		var that = this
		//asyncRequire(appDir + fileName).then(function(thisData){
		var thisData = require(appDir + '/' + fileName)	
		that.logger.log(moduleName, 2, 'loaded testData: ' + thisData)
			
		that.setupDemoData(thisData, function(){
			that.logger.log(moduleName, 2, 'Test Data Loaded...')
			callback()
		}) 
	},
	setupDemoData: function(demoData, callback){
		var that = this
		this.dropCollection(function(){
			//now import this spheron data into the db
			//that.logger.log(4,JSON.stringify(demoData))
			//now iterate the data and load it...
			that.createProblemDefinition(demoData, function(){
				that.createSpheronFromArrayIterator(0, demoData, function(){
					that.logger.log(4,'sample spherons created.')
					callback()
				})	
			})
		})
	},
	importProblem: function(problemDefinition, callback){
		/*
 		* Create Job Metadata db entry - (including testplan)
    	* Create initial Spheron network
    	* Load test plan onto activation spherons input queues - with a time based spread...
		*/
		var that = this
		that.createProblemDefinition(problemDefinition, function(){
			that.createSpheronFromArrayIterator(0, problemDefinition, function(){
				that.logger.log(4,'Problem imported, spheron array created.')
				callback()
			})
		})
	},
	createProblemDefinition: function(demoData, callback){
		var thisProblemDefinition = JSON.parse(JSON.stringify(demoData))
		//delete thisProblemDefinition.network
		mongoNet.insertOne(thisProblemDefinition, function(err, res) {
			if (err) throw err;
			callback()
		});
	},
	createSpheronFromArrayIterator: function(idx, problemDescription, callback){
		var that = this
		if(idx < (problemDescription.network).length){
			//that.logger.log(4,JSON.stringify(problemDescription.network[idx]))
			var thisSpheron = problemDescription.network[idx]
			thisSpheron.problemId = problemDescription.problemId
			mongoNet.insertOne(thisSpheron, function(err, res) {
				if (err) throw err;
				idx += 1
				that.createSpheronFromArrayIterator(idx, problemDescription, callback)
			});
		} else {
			callback()
		}
	},
	getNextPendingSpheron: function(tickStamp, callback){
		var that = this
		//The main function loop - pulls back spherons which are awaitng processing.
		//TODO: Works but needs to return the one with the lowest pendAct + state == pending
		that.logger.log(4,'getting next spheron for tick: ' + tickStamp)
		//nextTick: { $lt: thisNextTick },
					//
		mongoNet.findOneAndUpdate({
			nextTick: { $lt: tickStamp },
			type:"spheron",
			state:"pending"
		},{
			$set:{state:"running"}
		}, {
			new: true,
			sort: {nextTick: -1}
		}, function(err,doc){
			if(err){
				that.logger.log(4,'no pending spherons: ' + err)
				callback({})
			} else if (doc.value != null){ 
				that.logger.log(4,'spheron is: ' + JSON.stringify(doc.value))
				callback(doc.value)
			} else {
				that.logger.log(4,'spheron was null: ' + JSON.stringify(doc))
				callback({})
			}
		})
	},
	persistSpheron: function(spheronId, updateJSON, callback){
		var that = this
		that.logger.log(moduleName, 2, 'about to persist spheron: ' + spheronId)
		that.logger.log(moduleName, 2, 'update JSON is: ' + JSON.stringify(updateJSON))
		mongoNet.findOneAndUpdate({
			spheronId: spheronId
		},{
			$set: updateJSON
		}, 
		{}, 
		function(err,doc){
			if(err){
				that.logger.log(moduleName, 2, 'persist spheron error')
				callback()
			} else { 
				that.logger.log(moduleName, 2, 'success persisting spheron')
				callback()
			}	
		})
	},
	getTrainigData: function(problemId,callback){
		mongoNet.findOne({
			type: "lesson",
			problemId: problemId
		}, function(err, result) {
	    	if (err) throw err;
	    	callback(result.tests)
		});		
	},
	pushMessageToInputQueueBySpheronIdAndPort: function(spheronIdAndPort, thisMessage, callback){
		var that = this
		if(spheronIdAndPort){
			that.logger.log(moduleName, 2, 'spheronIdAndPort is:' + spheronIdAndPort) 
			that.logger.log(moduleName, 2, 'about to push stuff to:' + JSON.stringify(spheronIdAndPort))
			that.logger.log(moduleName, 2, 'got here')
			that.logger.log(moduleName, 2, 'toid:' + spheronIdAndPort.toId)
			that.getSpheron(spheronIdAndPort.toId, function(thisSpheron){
				if(thisSpheron){
					//TODO: None of this is validated...
					that.logger.log(moduleName, 2, 'Pushing to spherons inputQueue: ' +  thisSpheron.spheronId)
					that.logger.log(moduleName, 2, 'inputQueue is currently: ' +  JSON.stringify(thisSpheron.inputMessageQueue))

					thisSpheron.inputMessageQueue.push(thisMessage)
					that.logger.log(moduleName, 2, 'pushed to inputQueue')
					that.logger.log(moduleName, 2, 'inputQueue is now: ' +  JSON.stringify(thisSpheron.inputMessageQueue))
				
					that.pushVariants(thisSpheron, 0, -1, thisMessage, spheronIdAndPort.toPort, function(){
						that.logger.log(moduleName, 2, 'about to persist spheron: ' + JSON.stringify(thisSpheron))
						that.persistSpheron(thisSpheron.spheronId, thisSpheron, function(){
							that.logger.log(moduleName, 2, 'Spheron updated') 
							callback()
						})
					})
				} else {
					that.logger.log(2,'cannot update spheron, it did not exist...')
					process.exitCode = 1
				}
			})
		} else {
			callback()
		} 
	},
	pushVariants: function(thisSpheron, variantIdx, variantItemIdx, thisMessage, toPort, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running pushVariants')
		that.logger.log(moduleName, 2, 'thisSpheron is: ' + JSON.stringify(thisSpheron))
		if(thisSpheron.variants.inputs.length == 0){
			that.logger.log(moduleName, 2, 'no inputs to variate')
			callback()
		} else {

			if(thisSpheron.variants.inputs[variantIdx]){
				if(variantItemIdx == -1){
					if(thisSpheron.variants.inputs[variantIdx].original == toPort){
						that.pushVariants(thisSpheron, variantIdx, 0, thisMessage, toPort, callback)
					} else {
						that.pushVariants(thisSpheron, variantIdx +1, -1, thisMessage, toPort, callback)
					}
				} else if(thisSpheron.variants.inputs[variantIdx].variants[variantItemIdx]){


					//TODO: ok - substitiute this one and push it onto the queue...
					that.logger.log(moduleName, 2, 'about to substitute, push and iterate')
					//process.exitCode = 1


				} else {
					that.pushVariants(thisSpheron, variantIdx +1, -1, thisMessage, toPort, callback)
				}
			} else {
				that.logger.log(moduleName, 2, 'calling back from push variants')
				callback()
			}
		}
	}
}

module.exports = mongoUtils;
