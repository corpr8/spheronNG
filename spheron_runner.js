"use strict";

/*
* The runner which runs pending spherons and handles things such as propagation persistence (i.e. updating other spherons that they have stuff to do...)
*/
var moduleName = 'runner'
var settings = require('./settings.json')
var Logger = require('./logger.js')
var mongoUtils = require('./mongoUtils.js')
var Spheron = require('./spheron.js')
var generateUUID = require('./generateUUID.js')
var multivariator = require('./multivariator.js')
var UdpUtils = require('./udpUtils.js');


var spheron_runner = {
	udpUtils: null,
	logger: null,
	mutator: null,
	inputMessageQueueProcessor: null,
	activationQueueProcessor: null,
	propagationQueueProcessor: null,
	backpropQueueProcessor: null,
	multivariateTestProcessor: null,
	lessonMaintenanceProcessor: null,
	networkMaintenanceProcessor: null,
	spheron: null,
	systemTickTimer: null,
	systemTick: null,
	inTick: false,
	init: function(callback){
		var that = this
		that.logger = new Logger(settings.logOptions)
		that.logger.log(moduleName, 4,'Called Spheron_runner init function')

		that.mutator = require('./mutator.js')
		that.inputMessageQueueProcessor = require('./1-inputMessageQueueProcessor.js')
		that.activationQueueProcessor = require('./2-activationQueueProcessor.js')
		that.propagationQueueProcessor = require('./3-propagationQueueProcessor.js')
		that.backpropQueueProcessor = require('./4-backpropQueueProcessor.js')
		that.multivariateTestProcessor = require('./5-multivariateTestProcessor.js')
		that.lessonMaintenanceProcessor = require('./6-lessonMaintenanceProcessor.js')
		that.networkMaintenanceProcessor = require('./7-networkMaintenanceProcessor.js')

		//disable UDP if as we are offline...
		if(settings.loadUDP){
			that.udpUtils = new UdpUtils()
		}

		mongoUtils.init(that.logger, function(){
			if(settings.loadTestData == true){
				var testData = require(settings.testData)
				mongoUtils.setupDemoData(testData, function(){
					that.startTicking()
					callback()
				})	
			} else {
				that.startTicking()
				callback()
			}
		})
	},
	startTicking: function(){
		var that = this
		that.logger.log(moduleName, 4,'registering tick.')
		that.systemTick = 1
		that.systemTickTimer = setInterval(function(){
			that.tick()
		},100)
		return
	},
	stopTicking: function(){
		var that = this
		that.logger.log(moduleName, 4,'clearing tick.')
		clearInterval(that.systemTickTimer)
		return
	},
	isSpheron: function(candidate){
		return (candidate.spheronId) ? true : false
	},
	tick: function(){
		var that = this
		if(this.inTick == false){
			this.inTick = true
			that.logger.log(moduleName, 1,'systemTick: ' + that.systemTick)
			mongoUtils.getNextPendingSpheron(that.systemTick, function(result){ 
				if(that.isSpheron(result) == true){
					that.logger.log(moduleName, 2,'Processing spheron: ' + result.spheronId)
					that.spheron = new Spheron(result)
					that.spheron.init(that.logger, function(){
						that.logger.log(moduleName, 4,'Loaded spheron: ' + that.spheron.spheronId + ' - starting runtime functions.')
						that.processSpheron(0, function(){
							that.inTick = false
						})	
					})
				} else {
					that.systemTick += 1
					that.inTick = false

					if(settings.haltAfterTick == true){
						if(settings.haltAfterTickNo <= that.systemTick){
							that.doExit()
						}
					}
				}
			})
		}
	},
	processSpheron: function(phaseIdx, callback){
		var that = this
		switch(phaseIdx) {
			case 0:
				that.logger.log(moduleName, 2,'Begin Processing a Spheron. Tick is: ' + that.systemTick + " spheron id is: " + this.spheron.spheronId)
		        /*
				* Should we mutate?
				*
				* We can make this decision based on the cumulative errors in the exclusion Error map.
				* If the exclusion map is empty, this might also mean we want to mutate (as there are no experiments)
		        */
		        that.logger.log(moduleName, 2,'Phase0: should we mutate?')

		        that.mutator.init(that.spheron, that.logger, function(updatedSpheron){
		        	that.logger.log(moduleName, 4,'finished Phase 0')
		        	if(updatedSpheron){
		        		//we should update the in memory model 
		        	}
					that.postPhaseHandler(phaseIdx, callback)
		        })

				break;
			case 1: 
		        /*
				* Handle Input Message Queue Processing:
				*
				* Examine the input message queue and see if we have sets which can be used to activate the spheron
				* i.e. - groups with the same signalId
				* also check if there are exclusion maps and load them onto the activation queue - i.e. 12345, 12345a
		        */
		        that.logger.log(moduleName, 2,'Phase1: in the input message queue processor')
		        that.inputMessageQueueProcessor.init(that.spheron, that.logger, function(updatedSpheron){
		        	//update the in memory model
		        	that.spheron = updatedSpheron
		        	that.logger.log(moduleName, 2,'finished Phase 1')
			        that.postPhaseHandler(phaseIdx, callback)
		        })
		        break;
			case 2:
		        /*
				* Handle Activation Queue Processing:
				*
				* eveything in the activation queue is an individual set of coherant activation messages - 
				* i.e. for signal1234, input1, input2
				* it would also include a single variant - i.e. signal1234{1,2,3,4,5} or signal1234{1,2,3,4,5a}
				* so activate for each one and copy the result to the propagation queue
		        */
		        that.logger.log(moduleName, 2,'Phase2: in the input activation queue processor')
		        that.activationQueueProcessor.init(that.spheron, that.logger, function(){
		        	//update the in memory model
		        	that.logger.log(moduleName, 4,'finished Phase 2')
		        	//that.logger.log(moduleName, 4,'dump: ' + JSON.stringify(that.spheron))
			        that.postPhaseHandler(phaseIdx, callback)
		        })
		        break;
			case 3:
				/*
				* Handle propagation to downstream spherons...
				*/
				that.logger.log(moduleName, 2,'Phase3: propagate results to downstream spherons')
				that.propagationQueueProcessor.init(that.spheron, that.logger, mongoUtils, function(){ 
					that.logger.log(moduleName, 4,'finished Phase 3')
					//that.logger.log(moduleName, 4,'dump: ' + JSON.stringify(that.spheron))
			        that.postPhaseHandler(phaseIdx, callback)
				})
				break;
			case 4:
		        /*
		        * Handle backprop messages
		        * if the lesson is in mode=autoTrain:
		        */
		        that.logger.log(moduleName, 2,'Phase4: propagating backprop messages')
				that.backpropQueueProcessor.init(that.spheron, that.logger, mongoUtils, function(){
					that.logger.log(moduleName, 4,'finished Phase 4')
					that.postPhaseHandler(phaseIdx, callback)
				})
		        break;
		    case 5:
		        /*
		        * Handle multivariant resolution
		        *
		        * if the lesson is in mode=autoTrain:
		        * If the exclusion error map is full for both sides of a variant, we can calculate which performs best i.e: bias1 [0.1,0.23,0.25,0.39], bias1a [0.11,0.123,0.15,0.139] 
		        * bias1a definitely has the lowest errors and should outsurvive bias1
		        * clear each BackPropMessage as they have now served their purpose
		        * Increment phaseIdx and iterate
		        */
		        that.logger.log(moduleName, 2,'Phase5: handle multi-variant data storage and test resolution')
				that.multivariateTestProcessor.init(that.spheron, that.logger, function(){
					that.logger.log(moduleName, 4,'finished Phase 5')
					that.postPhaseHandler(phaseIdx, callback)
				})
				break;
			case 6:
		        that.logger.log(moduleName, 2,'Phase6: lesson maintenance')
		        /*
				* If we are an input spheron and the lesson is still in mode=autoTrain then check if the input queueLength is less than
			    * the number of test states and if so, push more lessons onto the stack.
			    */
		
				that.lessonMaintenanceProcessor.init(that.spheron, that.logger, function(){
					that.logger.log(moduleName, 4,'finished Phase 6 - lessonMaintenanceProcessor')
					that.postPhaseHandler(phaseIdx, callback)
				})
				break;
			case 7:
				/*
				* If the life of any of the connections to the spheron has decayed below a certain threshold then it is effctively static.
				* So convert it to a bias and 'vector add' that bias with the existent bias?
				* and convert that into an A/B test:
				* A: existant bias
				* B: existant bias vector added atrophed input.
				*/

		        that.logger.log(moduleName, 2,'Phase7: networkMaintenanceProcessor')
				that.networkMaintenanceProcessor.init(that.spheron, that.logger, function(){
					that.logger.log(moduleName, 4,'finished Phase 7 - networkMaintenanceProcessor')
					that.postPhaseHandler(phaseIdx, callback)
				})
				break;
		    case 8:
				/*
			     * Persist spheron to mongo.
			    */
				that.logger.log(moduleName, 2,'Phase8: persisting ' + that.spheron.spheronId + ' back to mongo...')
		    	that.persistSpheron({updateState: false}, function(){
		    		that.logger.log(moduleName, 4,'finished Phase 8')
					that.postPhaseHandler(phaseIdx, callback)
		    	})
		        break;
		    default:
		    	that.logger.log(moduleName, 2,'in default phase handler (i.e. The fallback.) - phase is: ' + phaseIdx)
		    	if(phaseIdx <= 8){
		    		that.postPhaseHandler(phaseIdx, callback)
		    	} else {
				    
					//that.lessonMaintenanceProcessor.init(that.spheron, that.logger, function(){
						phaseIdx = 0
						if(settings.haltAfterTick == true){
							if(settings.haltAfterTickNo <= that.systemTick){
								that.doExit()
							} else {
								callback()
							}
						} else if(settings.haltAfterProcessingSpheron == true){
							if(settings.haltAfterProcessingSpheronId == that.spheron.spheronId){
								that.doExit()
							} else {
								callback()
							}
						} else {
							callback()	
						}
					//})
		    	}
		}
	},
	doExit: function(){
		var that = this
		that.logger.exit(function(){
			that.stopTicking()
			process.exitCode = 0
			process.exit()
		})
	},
	postPhaseHandler: function(phaseIdx, callback){
		var that = this
		if(settings.persistAfterPhase[phaseIdx] == true){
			that.persistSpheron({updateState: settings.ifPersistUpdateState[phaseIdx]}, function(){
				process.nextTick(function(){
					phaseIdx += 1
					that.processSpheron(phaseIdx, callback)
				})
			})
		} else {
			phaseIdx += 1
			process.nextTick(function(){
				that.processSpheron(phaseIdx, callback)
			})
		}
	},
	persistSpheron: function(thisOptions, callback){
		//TODO: commit this spheron to mongo
		var that = this
		
		/*
		if(thisOptions.updateState == true){
			var oldestMessageAge = that._getOldestTickFromMessageQueue()
			if(oldestMessageAge > that.systemTick){
				this.spheron.state='pending'
				this.spheron.nextTick=that.systemTick +1
			}	
		}
		*/

		/*
		* not tested...  
		*/
		that.spheron.logger = null //get rid of the logger in the context of the spheron as we don't need it and don't want it in the database...

		mongoUtils.persistSpheron((that.spheron).spheronId, that.spheron,function(){
			that.spheron.logger = that.logger
			callback()	
		})
	}
}

spheron_runner.init(function(){
	var that = this
	spheron_runner.logger.log(moduleName, 4,'init complete')
	process.on('SIGINT', function() {
		spheron_runner.logger.log(moduleName, 4,'handling SIGINT - shutting down, bye!')
		that.doExit()
	});
})