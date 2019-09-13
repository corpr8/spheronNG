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
		that.logger.log(moduleName, 2, 'running init')
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
		try {
			mongoNet.drop(function(err, doc){
				that.logger.log(4,'dropped old database')
				callback()
			})
		} catch(err){
			callback()
		}
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
	getConnectionsBySpheronId(spheronId, callback){
		mongoNet.findOne({
			type: "spheron",
			spheronId: spheronId
		}, function(err, result) {
	    	if (err) throw err;
	    	callback(result.io)
		});	
	},
	getVariantsBySpheronId(spheronId, callback){
		mongoNet.findOne({
			type: "spheron",
			spheronId: spheronId
		}, function(err, result) {
	    	if (err) throw err;
	    	callback(result.variants)
		});	
	},
	getLessonModeById: function(lessonId, callback){
		mongoNet.findOne({
			type: "lesson",
			lessonId: lessonId
		}, function(err, result) {
	    	if (err){
	    		callback();
	    	} else {	
	    		callback(result.options.mode)
	    	}
		});
	},
	getLessonTestsById: function(lessonId, callback){
		mongoNet.findOne({
			type: "lesson",
			lessonId: lessonId
		}, function(err, result) {
	    	if (err){
	    		callback();
	    	} else {	
	    		callback(result.lesson)
	    	}
		});
	},
	getLessonPetrificationThresholdById: function(lessonId, callback){
		mongoNet.findOne({
			type: "lesson",
			lessonId: lessonId
		}, function(err, result) {
	    	if (err){
	    		callback();
	    	} else {
	    		if(result.options.petrificationThreshold){
					callback(result.options.petrificationThreshold)
	    		} else {
	    			callback(-1)
	    		}
	    		
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
		var that = this
		that.logger.log(moduleName, 2, 'Getting lesson length')  
		
		mongoNet.findOne({
			type: "lesson",
			lessonId: lessonId
		}, function(err, results) {
	    	if (err){

	    		that.logger.log(moduleName, 2, 'mongo error: ' + err)
	    		callback();
	    	} else {	

				that.logger.log(moduleName, 2, 'lesson length: ' + results.lesson.length)
	    		callback(results.lesson.length)
	    		//process.exitCode = 1
	    	}
		});
	},
	getLessonState: function(lessonId, callback){
		var that = this
		that.logger.log(moduleName, 2, 'Getting lesson state')  
		
		mongoNet.findOne({
			type: "lesson",
			lessonId: lessonId
		}, function(err, results) {
	    	if (err){

	    		that.logger.log(moduleName, 2, 'mongo error: ' + err)
	    		callback();
	    	} else {	
	    		that.logger.log(moduleName, 2, 'lesson dump: ' + JSON.stringify(results))
				that.logger.log(moduleName, 2, 'lesson state: ' + results.state)
	    		callback(results.state)
	    		//process.exitCode = 1
	    	}
		});
	},
	getPendingLesson(callback){
		var that = this
		mongoNet.findOneAndUpdate({
			type: "lesson",
			state : "pending"
		},{
			$set: {state: "evaluating"}
		}, 
		{}, 
		function(err,doc){
			if(err){
				callback()
			} else { 
				callback(doc)
			}	
		})
	},
	setLessonAsPending(lessonId, callback){
		var that = this
		mongoNet.findOneAndUpdate({
			type: "lesson",
			lessonId : lessonId
		},{
			$set: {state: "pending"}
		}, 
		{}, 
		function(err,doc){
			if(err){
				callback()
			} else { 
				callback(doc)
			}	
		})
	},
	setLessonAsIdle(lessonId, callback){
		var that = this
		mongoNet.findOneAndUpdate({
			type: "lesson",
			lessonId : lessonId
		},{
			$set: {state: "idle"}
		}, 
		{}, 
		function(err,doc){
			if(err){
				callback()
			} else { 
				callback(doc)
			}	
		})
	},
	assessIfLessonPassed(problemId, lowestFound, callback){
		/*
		*  Very very probably a legacy function... INfact definitely
		*/
		mongoNet.findOne({
			type: "lesson",
			problemId: problemId
		}, function(err, results) {
	    	if (err) {
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
		try{
			mongoNet.drop(function(err,doc){
				that.logger.log(4,'Collection dropped')
				callback()	
			})
		} catch(err){
			callback()
		}
	},
	setupDemoDataFromFile: function(fileName, callback){
		/*
		* Use this from the TDD framework to load a specific network - i.e. typically the current document (by file name)
		*/
		var that = this
		fs.readFile(appDir + '/' + fileName, function(err, thisData){
		  if (err) throw err;
		  that.logger.log(moduleName, 2, 'loaded testData: ')
			thisData = JSON.parse(thisData)
		  that.setupDemoData(thisData, function(){
			that.logger.log(moduleName, 2, 'Test Data Loaded...')
			callback()
		  })
		});
	},
	setupDemoData: function(demoData, callback){
		var that = this
		this.dropCollection(function(){
			//now import this spheron data into the db
			//that.logger.log(4,JSON.stringify(demoData))
			//now iterate the data and load it...
			that.createProblemDefinition(demoData, function(){
				that.createSpheronFromArrayIterator(0, demoData, function(){
					that.logger.log(moduleName, 4,'sample spherons created.')
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
				that.logger.log(moduleName, 4,'Problem imported, spheron array created.')
				callback()
			})
		})
	},
	createProblemDefinition: function(demoData, callback){
		var that = this
		that.logger.log(moduleName, 2,'creating problem definition')
		that.logger.log(moduleName, 2,'creating problem definition:' + JSON.stringify(demoData))
		var thisProblemDefinition = JSON.parse(JSON.stringify(demoData))
		delete thisProblemDefinition.network
		delete thisProblemDefinition.tdd

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
		that.logger.log(moduleName, 4,'getting next spheron for tick: ' + tickStamp)
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
				that.logger.log(moduleName, 4,'spheron is: ' + JSON.stringify(doc.value))
				callback(doc.value)
			} else {
				that.logger.log(4,'spheron was null: ' + JSON.stringify(doc))
				callback({})
			}
		})
	},
	persistSpheron: function(spheronId, updateJSON, callback){
		var that = this
		if(updateJSON.logger != null){
			updateJSON.logger = null
		}

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
				that.logger.log(moduleName, 2, 'persist spheron error' + err)
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
					var NewMessage = JSON.parse(JSON.stringify(thisMessage))
					that.logger.log(moduleName, 2, '****** ')
					that.logger.log(moduleName, 2, 'new message is: ' + JSON.stringify(NewMessage))




					//TODO: ok - substitiute this one and push it onto the queue... - note we have to update the database...


					that.logger.log(moduleName, 2, 'about to substitute, push and iterate')
					process.exitCode = 1


				} else {
					that.pushVariants(thisSpheron, variantIdx +1, -1, thisMessage, toPort, callback)
				}
			} else {
				that.logger.log(moduleName, 2, 'calling back from push variants')
				callback()
			}
		}
	},
	deleteConnectionFromUpstreamSpheronBySpheronId: function(spheronId, connectionId, callback){
		var that = this
		that.logger.log(moduleName, 2, 'updating spherons connections: ' + spheronId)
		that.getSpheron(spheronId, function(targetSpheron){
			that.deleteConnectionFromUpstreamSpheronBySpheronIdIterator(targetSpheron, 0, connectionId, function(targetSpheron){
				that.persistSpheron(spheronId, targetSpheron, function(){ 
					that.logger.log(moduleName, 2, 'updated spheron: ' + spheronId + ' io is now: ' + JSON.stringify(targetSpheron.io))
					callback() 
				})
			})
		})
	},
	deleteConnectionFromUpstreamSpheronBySpheronIdIterator: function(targetSpheron, spheronIdx, connectionId, callback){
		var that = this
		if(targetSpheron.io[spheronIdx]){
			if(targetSpheron.io[spheronIdx].id == connectionId){
				targetSpheron.io.splice(spheronIdx,1)
				that.cleanupTargetSpheronWhilstDeletingTests(targetSpheron, 0, 0, function(targetSpheron){
					that.deleteTargetSpheronsABTestDataIterator(targetSpheron, 0, function(targetSpheron){
						that.deleteConnectionFromUpstreamSpheronBySpheronIdIterator(targetSpheron, spheronIdx, connectionId, callback)	
					})
				})
			} else {
				that.deleteConnectionFromUpstreamSpheronBySpheronIdIterator(targetSpheron, spheronIdx+1, connectionId, callback)
			}
		} else {
			callback(targetSpheron)
		}
	},
	cleanupTargetSpheronWhilstDeletingTests: function(targetSpheron, testPhaseIdx, testIdx, callback){
		var connectionArray = []
		var that = this
		if(testPhaseIdx == 0){
			//handling input tests
			if(targetSpheron.variants.inputs[testIdx]){
				connectionArray = []
				for(var v=0;v<targetSpheron.variants.inputs[testIdx].variants.length;v++){
					connectionArray.push(targetSpheron.variants.inputs[testIdx].variants[v])
				}
				
				that.deleteVariantConnectionsFromTargetSpheronByArray(targetSpheron, connectionArray, 0, 0, function(){
					that.cleanupTargetSpheronWhilstDeletingTests(targetSpheron, testPhaseIdx, testIdx+1, callback)
				})
			} else {
				targetSpheron.variants.inputs = []
				that.cleanupTargetSpheronWhilstDeletingTests(targetSpheron, testPhaseIdx+1, 0, callback)
			}
		} else if(testPhaseIdx == 1){
			//handling bias tests
			if(targetSpheron.variants.biases[testIdx]){
				connectionArray = []
				for(var v=0;v<targetSpheron.variants.biases[testIdx].variants.length;v++){
					connectionArray.push(targetSpheron.variants.biases[testIdx].variants[v])
				}
				
				that.deleteVariantConnectionsFromTargetSpheronByArray(targetSpheron, connectionArray, 0, 0, function(){
					that.cleanupTargetSpheronWhilstDeletingTests(targetSpheron, testPhaseIdx, testIdx+1, callback)
				})
			} else {
				targetSpheron.variants.biases = []
				that.cleanupTargetSpheronWhilstDeletingTests(targetSpheron, testPhaseIdx+1, 0, callback)

			}
		} else if(testPhaseIdx == 2){
			//handling output tests
			if(targetSpheron.variants.outputs[testIdx]){
				connectionArray = []
				for(var v=0;v<targetSpheron.variants.outputs[testIdx].variants.length;v++){
					connectionArray.push(targetSpheron.variants.outputs[testIdx].variants[v])
				}
				
				that.deleteVariantConnectionsFromTargetSpheronByArray(targetSpheron, connectionArray, 0, 0, function(){
					that.cleanupTargetSpheronWhilstDeletingTests(targetSpheron, testPhaseIdx, testIdx+1, callback)
				})
			} else {
				targetSpheron.variants.outputs = []
				that.cleanupTargetSpheronWhilstDeletingTests(targetSpheron, testPhaseIdx+1, 0, callback)

			}
		} else {
			callback(targetSpheron)
		}
	},
	deleteVariantConnectionsFromTargetSpheronByArray: function(targetSpheron, connectionArray, idx, connectionIdx, callback){
		var that = this
		if(connectionArray[idx]){
			if(targetSpheron.io[connectionIdx]){
				if(targetSpheron.io[connectionIdx].id == connectionArray[idx]){
					targetSpheron.io.splice(connectionIdx,1)
					that.deleteVariantConnectionsFromTargetSpheronByArray(targetSpheron, connectionArray, idx+1, 0, callback)
				} else {
					that.deleteVariantConnectionsFromTargetSpheronByArray(targetSpheron, connectionArray, idx, connectionIdx+1, callback)
				}
			} else {
				that.deleteVariantConnectionsFromTargetSpheronByArray(targetSpheron, connectionArray, idx+1, 0, callback)
			}
			
		} else {
			callback(targetSpheron)
		}
	},
	deleteTargetSpheronsABTestDataIterator: function(targetSpheron, idx, callback){
		var that = this;
		if(targetSpheron.io[idx]){
			targetSpheron.io[idx].errorMap = []
			that.deleteTargetSpheronsABTestDataIterator(targetSpheron, idx+1, callback)
		} else {
			callback(targetSpheron)
		}
	},

	pushToUpstreamSpheronBPQueueBySpheronId: function(spheronId, bpErrorMessage, callback){
		var that = this
		that.logger.log(moduleName, 2, 'updating spherons bpQueue: ' + spheronId)
		that.getSpheron(spheronId, function(targetSpheron){
			targetSpheron.bpQueue.push(bpErrorMessage) 
			that.persistSpheron(spheronId, {bpQueue: targetSpheron.bpQueue}, function(){ 
				that.logger.log(moduleName, 2, 'updated spheron: ' + spheronId + ' bpQueue is now: ' + JSON.stringify(targetSpheron.bpQueue))
				callback() 
			})
		})
	}, 
	getLessonDataByLessonId: function(lessonId, callback){
		var that = this
		mongoNet.findOne({
			type: "lesson",
			lessonId: lessonId
		}, function(err, result) {
	    	if (err) throw err;
	    	callback(result)
		});
	},
	getIncrementLessonIdx: function(lessonId, callback){
		var that = this
		that.getLessonDataByLessonId(lessonId, function(lessonData){
			var lessonCount = lessonData.lesson.length
			var currentIdx = lessonData.lastLessonIdxProcessed
			var nextIdx = 0
			if(currentIdx < (lessonCount-1)){
				nextIdx = currentIdx +1
			}

			mongoNet.updateOne({
					type: "lesson", 
					lessonId: lessonId
				},{
					$set: {
						lastLessonIdxProcessed: nextIdx
					}
				}, 
				{}, 
				function(err,doc){
					if(err){
						that.logger.log(moduleName, 2, 'updating lessonIdx error' + err)
						callback(nextIdx)
					} else { 
						that.logger.log(moduleName, 2, 'updated lessonIdx: ')
						callback(nextIdx)
					}	
				}
			)
		})
	},
	getPropagationMessageQueueBySpheronId: function(spheronId, callback){
		var that = this
		mongoNet.findOne({
			type: "spheron",
			spheronId: spheronId
		}, function(err, result) {
	    	if (err) throw err;
	    	that.logger.log(moduleName, 2, 'propogationMessageQueueIs: ' + JSON.stringify(result.propagationMessageQueue))
	    	callback(result.propagationMessageQueue)
		});
	},
	getBackPropagationMessageQueueBySpheronId: function(spheronId, callback){
		var that = this
		mongoNet.findOne({
			type: "spheron",
			spheronId: spheronId
		}, function(err, result) {
	    	if (err) throw err;
	    	that.logger.log(moduleName, 2, 'bpQueue: ' + JSON.stringify(result.bpQueue))
	    	callback(result.bpQueue)
		});
	},
	updateLessonInputs: function(lessonId, spheronId, oldInput, newInput, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running mongo - updateLessonInputs.')
		that.getLessonDataByLessonId(lessonId, function(result){
			that.logger.log(moduleName, 2, 'current lesson data is:' + JSON.stringify(result))
			that.updateLessonInputIterator(0, spheronId, oldInput, newInput, result, function(updatedResult){
				that.logger.log(moduleName, 2, 'updated lesson data is:' + JSON.stringify(updatedResult))
				/*
				* TODO: persist the updatedResult...
				*/
				mongoNet.updateOne({
					type: "lesson", 
					lessonId: lessonId
				},{
					$set: {
						lesson: updatedResult.lesson
					}
				}, 
				{}, 
				function(err,doc){
					if(err){
						that.logger.log(moduleName, 2, 'persisted lesson error' + err)
						callback()
					} else { 
						that.logger.log(moduleName, 2, 'success persisting lesson: ' + JSON.stringify(doc))

						callback()
					}	
				})
			})
		})
	},
	updateSpheronInputConnectionBySpheronId:function(downstreamSpheronId, originalConnectionId, newConnectionId, callback){
		var that = this
		mongoNet.findOne({
			type: "spheron",
			spheronId: downstreamSpheronId
		}, function(err, spheronData) {
	    	if (err) throw err;
	    	that.updateSpheronInputConnectionBySpheronIdIterator(spheronData, 0, originalConnectionId, newConnectionId, function(spheronData){
	    		mongoNet.updateOne({
					type: "spheron", 
					spheronId: downstreamSpheronId
				},{
					$set: spheronData
				}, 
				{}, 
				function(err,doc){
					if(err){
						that.logger.log(moduleName, 2, 'persist downstream spheron error' + err)
						callback()
					} else { 
						that.logger.log(moduleName, 2, 'success persisting downstream spheron: ' + JSON.stringify(doc))
						callback()
					}	
				})
	    	})
		});
	},
	updateSpheronInputConnectionBySpheronIdIterator: function(spheronData, idx, originalConnectionId, newConnectionId, callback){
		var that = this
		try{
			if(spheronData.io[idx]){
				if(spheronData.io[idx].fromPort == originalConnectionId){
					if(newConnectionId == "none"){
						spheronData.io.splice(idx,1)
						/*
						* TODO: we should also delete any A/B test that this IO was part of (originalConnectionId)
						*/
					} else {
						spheronData.io[idx].fromPort = newConnectionId
						spheronData.io[idx].id = newConnectionId
						spheronData.io[idx].errorMap = []
					}

					that.logger.log(moduleName, 2, 'rewrote connection temp data from ' + originalConnectionId + ' to: ' + newConnectionId)
					callback(spheronData)
				} else {
					that.updateSpheronInputConnectionBySpheronIdIterator(spheronData, idx+1, originalConnectionId, newConnectionId, callback)
				}
			} else {
				that.logger.log(moduleName, 2, 'nothing to do, calling back. this is probably a problem. error.')
				callback(spheronData)
			}
		} catch (err){
			that.logger.log(moduleName, 2, 'updateSpheronInputConnectionBySpheronIdIterator error: ' + err)
		}
	},
	updateSpheronOutputConnectionBySpheronId:function(upstreamSpheronId, originalConnectionId, newConnectionId, callback){
		var that = this
		mongoNet.findOne({
			type: "spheron",
			spheronId: upstreamSpheronId
		}, function(err, spheronData) {
	    	if (err) throw err;
	    	that.updateSpheronOutputConnectionBySpheronIdIterator(spheronData, 0, originalConnectionId, newConnectionId, function(spheronData){
	    		mongoNet.updateOne({
					type: "spheron", 
					spheronId: upstreamSpheronId
				},{
					$set: spheronData
				}, 
				{}, 
				function(err,doc){
					if(err){
						that.logger.log(moduleName, 2, 'persist upstream spheron error' + err)
						callback()
					} else { 
						that.logger.log(moduleName, 2, 'success persisting upstream spheron: ' + JSON.stringify(doc))
						callback()
					}	
				})
	    	})
		});
	},
	updateSpheronOutputConnectionBySpheronIdIterator: function(spheronData, idx, originalConnectionId, newConnectionId, callback){
		var that = this
		if(spheronData.io[idx]){
			if(spheronData.io[idx].toPort == originalConnectionId){
				if(newConnectionId == "none"){
					spheronData.io.splice(idx,1)
					/*
					* TODO: we should also delete any A/B test that this IO was part of (originalConnectionId)
					*/
				} else {
					spheronData.io[idx].toPort = newConnectionId
					spheronData.io[idx].id = newConnectionId
					spheronData.io[idx].errorMap = []
				}
				
				that.logger.log(moduleName, 2, 'rewrote connection temp data from ' + originalConnectionId + ' to: ' + newConnectionId)
				callback(spheronData)
			} else {
				that.updateSpheronOutputConnectionBySpheronIdIterator(spheronData, idx+1, originalConnectionId, newConnectionId, callback)
			}
		} else {
			that.logger.log(moduleName, 2, 'nothing to do, calling back. this is probably a problem. error.')
			callback(spheronData)
		}
	},
	updateLessonInputIterator:function(lessonIdx, spheronId, oldInput, newInput, lessonData, callback){
		var that = this
		if(lessonData.lesson[lessonIdx]){
			if(lessonData.lesson[lessonIdx].inputs[spheronId][oldInput]){
				lessonData.lesson[lessonIdx].inputs[spheronId][newInput] = JSON.parse(JSON.stringify(lessonData.lesson[lessonIdx].inputs[spheronId][oldInput]))
				delete lessonData.lesson[lessonIdx].inputs[spheronId][oldInput]
				that.updateLessonInputIterator(lessonIdx+1 , spheronId, oldInput, newInput, lessonData, callback)
			} else {
				that.updateLessonInputIterator(lessonIdx+1 , spheronId, oldInput, newInput, lessonData, callback)
			}
		} else {
			callback(lessonData)
		}
	},
	updateLessonOutputs: function(lessonId, spheronId, oldOutput, newOutput, callback){
		var that = this
		that.logger.log(moduleName, 2, 'running mongo - updateLessonOutputs.')
		that.getLessonDataByLessonId(lessonId, function(result){
			that.logger.log(moduleName, 2, 'current lesson data is:' + JSON.stringify(result))
			that.updateLessonOutputIterator(0, spheronId, oldOutput, newOutput, result, function(updatedResult){
				that.logger.log(moduleName, 2, 'updated lesson data is:' + JSON.stringify(updatedResult))
				mongoNet.updateOne({
					type: "lesson", 
					lessonId: lessonId
				},{
					$set: {
						lesson: updatedResult.lesson
					}
				}, 
				{}, 
				function(err,doc){
					if(err){
						that.logger.log(moduleName, 2, 'persisted lesson error' + err)
						callback()
					} else { 
						that.logger.log(moduleName, 2, 'success persisting lesson: ' + JSON.stringify(doc))

						callback()
					}	
				})
			})
		})
	},
	updateLessonOutputIterator:function(lessonIdx, spheronId, oldOutput, newOutput, lessonData, callback){
		var that = this
		if(lessonData.lesson[lessonIdx]){
			if(lessonData.lesson[lessonIdx].outputs[spheronId][oldOutput]){
				lessonData.lesson[lessonIdx].outputs[spheronId][newOutput] = JSON.parse(JSON.stringify(lessonData.lesson[lessonIdx].outputs[spheronId][oldOutput]))
				delete lessonData.lesson[lessonIdx].outputs[spheronId][oldOutput]
				that.updateLessonOutputIterator(lessonIdx+1 , spheronId, oldOutput, newOutput, lessonData, callback)
			} else {
				that.updateLessonOutputIterator(lessonIdx+1 , spheronId, oldOutput, newOutput, lessonData, callback)
			}
		} else {
			callback(lessonData)
		}
	},
	deleteSigIdFromSpheronPropagationQueue(spheronId, targetSigId, callback){
		var that = this
		mongoNet.findOne({
			type: "spheron",
			spheronId: spheronId
		}, function(err, result) {
	    	if (err) throw err;
	    	that.deleteSigIdFromSpheronPropagationQueueIterator(result, targetSigId, 0, function(updatedSpheron){
				mongoNet.findOneAndUpdate({
					type: "spheron",
					spheronId : spheronId
				},{
					$set: {propagationMessageQueue: updatedSpheron.propagationMessageQueue}
				}, 
				{}, 
				function(err,doc){
					if(err) throw err
					//eventually
		    		callback(result)
				})	    		
	    	})
		});
	},
	deleteSigIdFromSpheronPropagationQueueIterator(thisSpheron, targetSigId, idx, callback){
		var that = this
		if(thisSpheron.propagationMessageQueue[idx]){
			if(thisSpheron.propagationMessageQueue[idx].signalId == targetSigId){
				thisSpheron.propagationMessageQueue.splice(idx, 1)
			}
			that.deleteSigIdFromSpheronPropagationQueueIterator(thisSpheron, targetSigId, idx+1, callback)
		} else {
			callback(thisSpheron)
		}
	},
	updateLessonError(lessonId, lessonIdx, spheronId, portId, thisError, callback){
		mongoNet.findOne({
			type: "lesson",
			lessonId: lessonId
		}, function(err, result) {
	    	if (err){
	    		callback();
	    	} else {	
	    		//now update the object...
	    		result.lesson[lessonIdx].outputs[spheronId][portId].error = thisError
				mongoNet.findOneAndUpdate({
					type: "lesson",
					lessonId : lessonId
				},{
					$set: {lesson: result.lesson}
				}, 
				{}, 
				function(err,doc){
					if(err){
						callback()
					} else { 
						callback(doc)
					}	
				})
	    	}
		});
	}
}

module.exports = mongoUtils;
