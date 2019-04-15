"use strict";

/*
* A spheron is a configurable computing unit. It an instance of the active component of a Speheronet.
*/
var moduleName = 'spheron'
var settings = require('./settings.json')
var add = require('vectors/add')(2)
var mag = require('vectors/mag')(2)
var generateUUID = require('./generateUUID.js')
var heading = require('vectors/heading')(2)
const radToDeg = 180 / Math.PI
const degToRad = Math.PI / 180

var Spheron = function (config) {
	var that = this
	//connections, exclusions, mode, problemId, testLength, testIdx
	that.logger = null
	that.io = (config.io) ? config.io : {}
	that.signalVector = {}
	that.state = 'idle'
	that.settings =  (config.settings) ? config.settings : null 
	that.spheronId =  (config.spheronId) ? config.spheronId : "missing" 
	that.problemId = (config.problemId) ? config.problemId : -1 //a global id for the problem that this spheron is trying to solve.
	that.testLength = (config.testLength) ? config.testLength : -1 //how long is the test plan?
	that.testIdx = (config.testIdx) ? config.testIdx : -1 //if we are running a testl what is our current testIdx?
	that.trainingMode = (config.trainingMode) ? config.trainingMode : true //do we actually want to back propagate and evolve? (true)
	that.activationHistory = (config.activationHistory) ? config.activationHistory : [] 


	that.inputMessageQueue = (config.inputMessageQueue) ? config.inputMessageQueue : [] //individual port messages - these require martialling into a coherent signal
	that.activationQueue = (config.activationQueue) ? config.activationQueue : [] //the martialled, coherant signal - i.e. sigId 1234 on ports 1 and 2
	that.outputMessageQueue = (config.outputMessageQueue) ? config.outputMessageQueue : [] //the post activation signals


	that.variantMaps = (config.variantMaps) ? config.variantMaps : [] //details of ab tests i.e [["bias1", "bias1a", "bias1b"]]
	that.variantErrorMaps = (config.variantErrorMaps) ? config.variantErrorMaps : [] 
	that.propagationMessageQueue = (config.propagationMessageQueue) ? config.propagationMessageQueue : {} //messages waiting to be passed downstream
	that.bpErrorMessageQueue = (config.bpErrorMessageQueue) ? config.bpErrorMessageQueue : [] //backpropped messages waiting to be processed and passed upstream 
	that.exclusionErrorMaps = (config.exclusionErrorMaps) ? config.exclusionErrorMaps : [] //Here we will maintain our understanding of the performance of different variants
	that.options = (config.options) ? config.options : {}
	that.exclusions = (config.exclusions) ? config.exclusions : []
	that.nextTick = (config.nextTick) ? config.nextTick : 0 
}

Spheron.prototype.init = function(logger){
	var that = this
	that.logger = logger
	that.logger.log(moduleName, 4, that.spheronId + ' initialised')	
}

Spheron.prototype.calculateSignalVector = function(){
	/*
	* Calculates the result vector from adding all inputs or biases together.
	* Note: Not tested with exlusions as yet. Exclusions accepts an array of exclusionId's (specifically for A/B Multivariant)
	*/
	let rv = [0,0]
	let signalTrace = []

	for(var key in this.io) {
		let excludeThis = false
		for(var excludeId in this.exclusions){
			if(this.io[key].id == this.exclusions[excludeId]){
				excludeThis = true
			}
		}
		if(!excludeThis){
			var thisConn = this.io[key]
	        if(thisConn.type == 'input' || thisConn.type == 'bias' || thisConn.type == 'extInput'){
	        	var thisConnCart = this._p2c(thisConn.val,(thisConn.angle * degToRad))
	        	add(rv, thisConnCart)
	        }
		}
    }
    this.signalVector = rv
    return
}

Spheron.prototype.updateInputs = function(inputSignals){
	if(inputSignals){
		for(var key in inputSignals) {
			var thisConnSignal = inputSignals[key]
			for(var connection in this.io){
				if((this.io[connection]).id == key){
					(this.io[connection]).val = thisConnSignal.val
					(this.io[connection]).testIdx = thisConnSignal.testIdx
				}
			}
		}
	}
	return
}

Spheron.prototype.updateExclusions = function(exclusions){
	/*
	* setter for exclusions - should take an array of id's to exclude from processing.
	*/
	if(exclusions){
		if(Array.isArray(exclusions)){
			this.exclusions = exclusions
		} else {
			this.exclusions = exclusions.split(',')
		}
	}
	return
}

Spheron.prototype.setProblemId = function(problemId){
	this.problemId = problemId
	return
}

Spheron.prototype.activate = function(inputSignals, exclusions, callback){
	/*
	* Activate as above but exclude anything that happens to be in the exclusions array []. 
	* This is useful for propagating signals which are part of an A/B test.
	* update input values - in this instance.
	*/
	var that = this
	if(inputSignals){
		this.updateInputs(inputSignals)	
	}

	if(exclusions){
		this.updateExclusions(exclusions)	
	}

	this.calculateSignalVector()
	var thisResults = {}
	/*
	* now cycle the outputs and add them to thisResults as well as updating their value - if they are not excluded from test
	*/
	var theseOutputs = []
	var theseInputIdxs = []
	for(var key in this.io) {
		var thisConn = this.io[key]
		var excludeThis = false
		for(var excludeId in this.exclusions){
			if(this.io[key].id == this.exclusions[excludeId]){
				excludeThis = true
			}
		}
		if(excludeThis == false){
			if(thisConn.type == 'output' || thisConn.type == 'extOutput'){
				theseOutputs.push(thisConn.id)
			}
			if(thisConn.type == 'input' || thisConn.type == 'extInput'){
				theseInputIdxs.push(key)
			}
		}
	}

	for(var key in this.io) {
		var thisConn = this.io[key]
		var excludeThis = false
		for(var excludeId in this.exclusions){
			if(this.io[key].id == this.exclusions[excludeId]){
				excludeThis = true
			}
		}

		if(excludeThis == false){
			that.logger.log(moduleName, 6,'thisConn path: ' + thisConn.path)
			thisConn.path = (thisConn.path !== undefined) ? thisConn.path : thisConn.id
			that.logger.log(moduleName, 6,'thisConn path is: ' + thisConn.path)
			
			for(var thisOutput in theseOutputs){

				if(typeof thisResults[theseOutputs[thisOutput]] == "undefined"){
					thisResults[theseOutputs[thisOutput]] = {}
				}

				thisResults[theseOutputs[thisOutput]].toPort = thisConn.toPort
				if(typeof thisResults[theseOutputs[thisOutput]].path == "undefined"){
					thisResults[theseOutputs[thisOutput]].path = thisConn.path

				} else {
					thisResults[theseOutputs[thisOutput]].path = thisResults[theseOutputs[thisOutput]].path + ';' + thisConn.path
				}
				thisResults[theseOutputs[thisOutput]].testIdx = that.io[theseInputIdxs[0]].testIdx //<--- Why [0]???????
			}

			if(thisConn.type == 'output' || thisConn.type == 'extOutput'){
				//find signalVector as a polar angle
				var signalVectorHeading = heading(this.signalVector,[0,0])
				var outputHeading = thisConn.angle * degToRad
				var outputAmp = Math.cos(Math.abs(signalVectorHeading - outputHeading))
				var outputFinal = Math.floor((mag(this.signalVector) * outputAmp) * 100000)/100000
				thisConn.val = outputFinal

				/*
				* now apply any output flattening function
				*/
				thisConn.val = that._runOutputFn(thisConn)
				thisResults[that.io[key].id].val = thisConn.val

				that.logger.log(moduleName, 4,JSON.stringify('***' + JSON.stringify(thisConn)))
				thisResults[that.io[key].id].problemId = thisConn.problemId

				/*does not work currently*/
				thisResults[that.io[key].id].isVariant = thisConn.isVariant

				/*
				* lets dump the destination port into 'toPort' so we can make propagation simpler for multivariant use cases.
				* Rather than getting it from the message path - as the message path will contain variants and the current
				* method uses duplicate naming to denote a path at the network level...
				*
				* Check the activation iterator as we will need to use it there. (1568)
				*/
			}
		} else {
			that.logger.log(moduleName, 4,'we excluded: ' + thisConn.id)
		}
	}
	
	if(callback){
		that.logger.log(moduleName, 4,'calling back from spherons activate function - with these results: ' +  JSON.stringify(thisResults))
		callback(thisResults)
	} else {
		that.logger.log(moduleName, 4,'returning from spherons activate function - with the result: ' +  JSON.stringify(thisResults))
		return thisResults
	}
}

Spheron.prototype._runOutputFn = function(thisConn){
	var that = this
	if(thisConn.outputFn){
		that.logger.log(moduleName, 4,'we had an output function')
		if(that.trainingMode == true && thisConn.outputFn.ignoreWhileTrain == true){
			//nothing to do.
		} else {
			if(thisConn.outputFn.mode == "eq"){
				//tests if equal
				thisConn.val = (thisConn.val == thisConn.outputFn.val) ? 1 : 0
			} else if(thisConn.outputFn.mode == "neq"){
				//tests if not equal
				thisConn.val = (thisConn.val != thisConn.outputFn.val) ? 1 : 0
			} else if(thisConn.outputFn.mode == "neq_nz"){
				//tests if not equal && not zero
				thisConn.val = (thisConn.val != thisConn.outputFn.val && thisConn.val != 0) ? 1 : 0
			} else if(thisConn.outputFn.mode == "sigmoid"){
				//applies the sigmoid flattening function ala traditional neurons.
				//*** To be verified ***
				thisConn.val = 1 / (1 + Math.exp(-thisConn.val))
				//*** end To be verified ***
			} else {
				that.logger.log(moduleName, 4,'output function not handled as yet. Please code it. ')
			}
		}
	}
	return thisConn.val 
}

Spheron.prototype._p2c = function(r, theta){return [(Math.floor((r * Math.cos(theta)) * 100000))/100000, (Math.floor((r * Math.sin(theta)) * 100000))/100000]}

Spheron.prototype.getInputMessageQueue = function(callback){
	var that = this;
	callback(that.inputMessageQueue)
}

Spheron.prototype.getInputMessageQueueLength = function(callback){
	var that = this;
	callback(that.inputMessageQueue.length)	
}


Spheron.prototype.getActivationQueue = function(callback){
	var that = this;
	console.log(moduleName, 4, that.spheronId + '****activationQueue: ' + JSON.stringify(that.activationQueue))
	callback(that.activationQueue)	
}

Spheron.prototype.pushSignalToInputMessageQueue = function(thisSignal, callback){
	var that = this;
	//that.logger.log(moduleName, 4, that.spheronId + '****pushing to activationQueue: ' + JSON.stringify(thisSignal))
	that.inputMessageQueue.push(thisSignal) 
	callback()
}


Spheron.prototype.pushSignalToActivationQueue = function(thisSignal, callback){
	var that = this;
	//that.logger.log(moduleName, 4, that.spheronId + '****pushing to activationQueue: ' + JSON.stringify(thisSignal))
	that.activationQueue.push(thisSignal) 
	callback()
}

Spheron.prototype.removeItemFromInputQueueByIdx = function(thisIdx, callback){
	var that = this;
	
	//that.logger.log(moduleName, 4, that.spheronId + '****inputQueue: ' + JSON.stringify(that.inputMessageQueue))
	that.inputMessageQueue.splice(thisIdx,1)
	//that.logger.log(moduleName, 4, that.spheronId + '****inputQueue: ' + JSON.stringify(that.inputMessageQueue))
	callback()

}

module.exports = Spheron;