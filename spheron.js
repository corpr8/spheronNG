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
	that.logger = null 
	that.io = (config.io) ? config.io : {}
	that.signalVector = {} //temp holder for the absolute signal vector
	that.generatedSignalPath = "" //temp holder for the generated signal path
	that.state = 'idle'
	that.settings =  (config.settings) ? config.settings : null 
	that.spheronId =  (config.spheronId) ? config.spheronId : "missing" 
	that.lessonId = (config.lessonId) ? config.lessonId : -1 //a global id for the problem that this spheron is trying to solve.
	that.signalId = (config.signalId) ? config.signalId : -1
	that.lessonIdx = (config.lessonIdx) ? config.lessonIdx : -1 //if we are running a testl what is our current lessonIdx?
	that.trainingMode = (config.trainingMode) ? config.trainingMode : true //do we actually want to back propagate and evolve? (true)
	that.activationHistory = (config.activationHistory) ? config.activationHistory : []
	that.inputMessageQueue = (config.inputMessageQueue) ? config.inputMessageQueue : [] //individual port messages - these require martialling into a coherent signal
	that.activationQueue = (config.activationQueue) ? config.activationQueue : [] //the martialled, coherant signal - i.e. sigId 1234 on ports 1 and 2
	that.variants = (config.variants) ? config.variants : [] //the post activation signals
	that.propagationMessageQueue = (config.propagationMessageQueue) ? config.propagationMessageQueue : [] //messages waiting to be passed downstream
	that.bpQueue = (config.bpQueue) ? config.bpQueue : [] //backpropped messages waiting to be processed and passed upstream 
	that.nextTick = (config.nextTick) ? config.nextTick : 0 
}

Spheron.prototype.init = function(logger, callback){
	var that = this
	that.logger = logger
	that.logger.log(moduleName, 2, that.spheronId + ' initialised')	
	callback()
}

//TODO: Make the below function aware of the individual bias - i.e. if we have no variants or the variant IDX.
Spheron.prototype.calculateSignalVectorIterator = function(biasIdx, idx, resultantRV, callback){
	var that = this
	if(that.io[idx]){
		var thisConn = that.io[idx]
		if(thisConn.val != "excluded" && (thisConn.type == 'input' || (thisConn.type == 'bias' && thisConn.id == that.variants.biases[biasIdx]) || (thisConn.type == 'bias' && that.variants.biases.length == 0) || thisConn.type == 'extInput')){
			that.logger.log(moduleName, 4, '***vector adding: ' + thisConn.type + ' : ' + thisConn.id + ' value: ' + thisConn.val)
			var thisConnCart = this._p2c(thisConn.val,(thisConn.angle * degToRad))
	        add(resultantRV, thisConnCart)
		} 
		that.calculateSignalVectorIterator(biasIdx, idx+1, resultantRV, callback)
	} else {
		callback(resultantRV)
	}
}

//update inputs based on activation information.
Spheron.prototype.updateInputsIterator = function(idx, inputSignals, callback){
	var that = this 
	if(inputSignals.io[idx]){
		that.searchUpdateInputIterator(0, inputSignals.io[idx], function(){
			that.updateInputsIterator(idx+1, inputSignals, callback)
		})
	} else {
		callback()
	}
}

Spheron.prototype.searchUpdateInputIterator = function(ioIdx, thisConnSignal, callback){
	var that = this
	if(that.io[ioIdx]){
		that.logger.log(moduleName, 4, ("***that.io[ioIdx].id: " + that.io[ioIdx].id + " thisConnSignal.input:  " + thisConnSignal.input))
		if(that.io[ioIdx].id == thisConnSignal.input){
			that.logger.log(moduleName, 4, '***updating input: ' + that.io[ioIdx].id + ' value: ' + thisConnSignal.val)
			if(thisConnSignal.val == "static"){
				/*
				* If we are passed static data from the input queue then there was no actual input on this channel
				* and it should start to atrophy toward a static state. The actual transfer to static should happen in 
				* a later phase as it will require some network wide alterations.
				*/
				that.io[ioIdx].life = (that.io[ioIdx].life) ? that.io[ioIdx].life / 2 : .5
			} else {
				that.io[ioIdx].val = thisConnSignal.val	
			}
			
			that.io[ioIdx].path = thisConnSignal.path
			that.io[ioIdx].lessonIdx = thisConnSignal.lessonIdx
			callback()
		} else {
			that.searchUpdateInputIterator(ioIdx +1, thisConnSignal, callback)
		}
	} else {
		callback()
	}
}

/* end update inputs */
Spheron.prototype.setProblemId = function(problemId){
	this.problemId = problemId
	return
}

/*
*TODO: We still need to calculate signal paths...
*/

Spheron.prototype.generateOutputObject = function(callback){
	var that = this
	that.generateOutputObjectIterator({},-1,0,function(){
		callback()
	})
}

Spheron.prototype.generateSignalPath = function(biasIdx, callback){
	var that = this
	that.signalPathIterateIO(0,0,biasIdx,"", function(generatedPath){
		callback(generatedPath)
	})

}

Spheron.prototype.signalPathIterateIO = function(idx, mode, biasIdx, generatedPath, callback){
	var that = this
	if(mode >= 2){
		callback(generatedPath)
	} else if(that.io[idx]){
		if(mode == 0){
			if((that.io[idx].type == "input" || that.io[idx].type == "extInput") && that.io[idx].val != "excluded"){
				generatedPath += that.io[idx].id + ";"
			}
			that.signalPathIterateIO(idx+1, mode, biasIdx, generatedPath, callback)	
		} else if(mode == 1){
			if(that.variants.biases.length == 0){
				if(that.io[idx].type == "bias"){
					generatedPath += that.io[idx].id + ";"
				} 
				that.signalPathIterateIO(idx+1, mode, biasIdx, generatedPath, callback) 
			} else {
				generatedPath += that.variants.biases[biasIdx] + ";"
				that.signalPathIterateIO(0, mode+1, biasIdx, generatedPath, callback) 
			}
		}
	} else {
		that.signalPathIterateIO(0, mode+1, biasIdx, generatedPath, callback)
	}
	
}

Spheron.prototype.generateOutputObjectIterator = function(resultantObject, idx, biasIdx, callback){
	var that = this
	//passthrough this once for each of the biases (we are AB testing biases) OR, just pass through once as no test.
	if((that.variants.biases.length == 0 && biasIdx ==0) || that.variants.biases[biasIdx]){
		if(idx == -1){
			// recalculate the signal vector for this test of biasIdx
			that.calculateSignalVectorIterator(biasIdx, 0, [0,0], function(resultantRV){
				that.signalVector = resultantRV
				that.generateSignalPath(biasIdx, function(generatedSignalPath){
					that.generatedSignalPath = generatedSignalPath
					that.generateOutputObjectIterator(resultantObject, idx+1, biasIdx, callback)
				})
			})
		} else {
			if(idx == 0){
				resultantObject = {}
			}

			if(that.io[idx]){
				var thisConn = that.io[idx]
				if(thisConn.type == 'output' || thisConn.type == 'extOutput'){
					//find signalVector as a polar angle
					var signalVectorHeading = heading(that.signalVector,[0,0])
					var outputHeading = thisConn.angle * degToRad
					var outputAmp = Math.cos(Math.abs(signalVectorHeading - outputHeading))
					var outputFinal = Math.floor((mag(that.signalVector) * outputAmp) * 100000)/100000
					thisConn.val = outputFinal

					/*
					* now apply any output flattening function
					*/
					thisConn.val = that._runOutputFn(thisConn)
					that.logger.log(moduleName, 4, JSON.stringify('***that.io[idx].id: ' + that.io[idx].id))

					resultantObject.lessonId = that.lessonId
					resultantObject.lessonIdx = that.lessonIdx
					resultantObject.signalId = that.signalId
					resultantObject.io = (resultantObject.io) ? resultantObject.io : []

					var newObject = {
						"signalPath" : that.generatedSignalPath + that.io[idx].id + ";",
						"output" : that.io[idx].id,
						"type" : that.io[idx].type,
						"val" : thisConn.val
					}

					
					resultantObject.io.push(newObject)

					that.logger.log(moduleName, 4, JSON.stringify('***thisConn: ' + JSON.stringify(thisConn)))
					that.logger.log(moduleName, 4, JSON.stringify('***resultantOutputObject: ' + JSON.stringify(resultantObject)))
				}
				that.generateOutputObjectIterator(resultantObject, idx+1, biasIdx, callback)
			} else {
				//TODO: Write the resultant file to the propogation queue
				that.propagationMessageQueue.push(resultantObject)
				that.logger.log(moduleName, 4, JSON.stringify('***resultantOutputArray: ' + resultantObject))
				that.generateOutputObjectIterator(resultantObject, -1, biasIdx+1, callback)
			}
		}
 
	} else {
		callback()
	}
}

Spheron.prototype.activate = function(inputSignals, callback){
	var that = this
	that.lessonId = inputSignals.io[0].lessonId //TODO: We should count the most occurant lessonId and use that. Or fix it in the rest of the platform...
	that.lessonIdx = inputSignals.io[0].lessonIdx //TODO: We should count the most occurant lessonId and use that. Or fix it in the rest of the platform...
	that.signalId = inputSignals.signalId
	that.updateInputsIterator(0, inputSignals, function(){	
		that.generateOutputObject(function(){
			that.logger.log(moduleName, 2,'spheron with Id: ' + that.spheronId + ' activated')
			callback() 
		})
	})
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

Spheron.prototype.getIO = function(callback){
	var that = this;
	console.log(moduleName, 4, that.spheronId + '****getIO called')
	callback(that.io)
}


Spheron.prototype.pushSignalToInputMessageQueue = function(thisSignal, callback){
	var that = this;
	//that.logger.log(moduleName, 4, that.spheronId + '****pushing to activationQueue: ' + JSON.stringify(thisSignal))
	that.inputMessageQueue.push(thisSignal) 
	callback()
}

Spheron.prototype.pushSignalGroupToActivationQueue = function(thisSignalGroup, callback){
	var that = this;
	/*
	* Note: this is a hairy hack to cope with my by standards up till now.s
	*
	*/

	//note: we have changed the activationquee standard to have {signalId: x, signal:[]} 
	//however, this function accepts the old sgtandard and transforms it...

	var thisSignal = {
		"signalId": Object.keys(thisSignalGroup)[0],
		"io": thisSignalGroup[Object.keys(thisSignalGroup)[0]]
	}

	that.activationQueue.push(thisSignal) 
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
	that.inputMessageQueue.splice(thisIdx,1)
	callback()
}

Spheron.prototype.removeItemFromActivationQueueByIdx = function(thisIdx, callback){
	var that = this;
	that.activationQueue.splice(thisIdx,1)
	callback()
}

Spheron.prototype.getPropagationMessageQueue = function(callback){
	var that = this;
	console.log(moduleName, 4, that.spheronId + '****propogationMessageQueue: ' + JSON.stringify(that.propagationMessageQueue))
	callback(that.propagationMessageQueue)
}

Spheron.prototype.removeItemFromPropagationQueueByIdx = function(thisIdx, callback){
	var that = this;
	that.propagationMessageQueue.splice(thisIdx,1)
	callback()
}

Spheron.prototype.getToSpheronIdAndPortFromPortIterator =function(portId, idx, callback){
	console.log(moduleName, 2, 'portId: ' + portId)
	var that = this
	if(that.io[idx]){
		if(that.io[idx].id == portId){
			callback({
				toId: that.io[idx].toId,
				toPort: that.io[idx].toPort
			})
		} else {
			that.getToSpheronIdAndPortFromPortIterator(portId,idx +1, callback)
		}
	} else {
		callback(null)
	}
}

Spheron.prototype.getspheronPortTypeIterator =function(portId, idx, callback){
	console.log(moduleName, 2, 'portId: ' + portId)
	var that = this
	if(that.io[idx]){
		if(that.io[idx].id == portId){
			callback(that.io[idx].type)
		} else {
			that.getspheronPortTypeIterator(portId,idx +1, callback)
		}
	} else {
		callback(null)
	}
}


Spheron.prototype.removebpQueueItemByIdx = function(thisIdx, callback){
	var that = this;
	that.bpQueue.splice(thisIdx,1)
	callback()
}

Spheron.prototype.deleteConnectionByIdArray = function(connectionsIdArray, callback){
	var that = this
	if(connectionsIdArray.length > 0){
		that.deleteConnectionById(connectionsIdArray[0], function(){
			connectionsIdArray.splice(0,1)
			deleteConnectionByIdArray(connectionsIdArray, callback)
		})
	} else {
		callback()
	}
}

Spheron.prototype.deleteConnectionById = function(thisId, callback){
	var that = this
	that.deleteConnectionByIdIterator(thisId, 0, function(){
		callback()
	})
}

Spheron.prototype.deleteConnectionByIdIterator = function(thisId, idx, callback){
	var that = this
	if(that.io[idx]){
		if(that.io[idx].id == thisId){
			that.logger.log(moduleName, 2, "deleting:" + thisId) 
			that.io.splice(idx,1)
			callback()
		} else {
			that.deleteConnectionByIdIterator(thisId, idx +1, callback)
		}
	} else {
		callback()
	}
}

Spheron.prototype.convertConnectionToBiasById = function(thisId, callback){
	var that = this
	that.convertConnectionToBiasByIdIterator(thisId, 0, function(){
		callback()
	})
}

Spheron.prototype.convertConnectionToBiasByIdIterator = function(thisId, idx, callback){
	var that = this
	if(that.io[idx]){
		if(that.io[idx].id == thisId){
			that.logger.log(moduleName, 2, "petrifying connection - transforming:" + thisId) 
			
			that.io[idx].type = "bias"
			that.io[idx].errorMap = []
			delete that.io[idx].fromId
			delete that.io[idx].fromPort
			delete that.io[idx].life

			callback()
		} else {
			that.convertConnectionToBiasByIdIterator(thisId, idx +1, callback)
		}
	} else {
		callback()
	}
}



Spheron.prototype.deleteConnectionByIdx = function(idx, callback){
	var that = this
	if(that.io[idx]){
		that.logger.log(moduleName, 2, "deleting:" + that.io[idx].idx)
		that.io.splice(idx,1)
		callback()
	} else {
		callback()
	}
}


Spheron.prototype.deleteAllTestData = function(callback){
	var that = this
	that.deleteAllTestDataIterator(0, function(){
		callback()
	})
}

Spheron.prototype.deleteAllTestDataIterator = function(idx, callback){
	var that = this;
	if(that.io[idx]){
		that.io[idx].errorMap = []
		that.deleteAllTestDataIterator(idx+1, callback)
	} else {
		callback()
	}
}

Spheron.prototype.deleteTestObject = function(mvTestObject, callback){
	var that = this
	that.logger.log(moduleName, 2, 'running deleteTestObject') 
	that.logger.log(moduleName, 2, 'test object is: ' + JSON.stringify(mvTestObject))
	that.deleteTestObjectIterator(mvTestObject, 0, 0,function(){
		callback();
	})
}

Spheron.prototype.deleteTestObjectIterator = function(mvTestObject, idx, phaseIdx, callback){
	var that = this
	that.logger.log(moduleName, 2, 'running deleteTestObjectIterator') 
	if(phaseIdx == 0){
		if(that.variants.inputs[idx]){ 
			that.logger.log(moduleName, 2, JSON.stringify(that.variants.inputs[idx]) + ' vs: ' + JSON.stringify(mvTestObject)) 
			if(JSON.stringify(that.variants.inputs[idx]) == JSON.stringify(mvTestObject)){
				that.logger.log(moduleName, 2, 'we found an input matching an mvTestObject!') 
				that.variants.inputs.splice(idx,1)
				callback()
			} else {
				that.deleteTestObjectIterator(mvTestObject, idx+1, phaseIdx, callback)
			}
		} else {
				that.deleteTestObjectIterator(mvTestObject, 0, phaseIdx+1, callback)
		}
	} else if(phaseIdx == 1){
		if(that.variants.biases[idx]){
			if(JSON.stringify(that.variants.biases[idx]) == JSON.stringify(mvTestObject)){
				that.logger.log(moduleName, 2, 'we found a bias matching an mvTestObject!') 
				that.variants.biases.splice(idx,1)
				callback()
			} else {
				that.deleteTestObjectIterator(mvTestObject, idx+1, phaseIdx, callback)
			}
		} else {
			that.deleteTestObjectIterator(mvTestObject, 0, phaseIdx+1, callback)
		}
	} else if(phaseIdx == 2){
		if(that.variants.outputs[idx]){
			if(JSON.stringify(that.variants.outputs[idx]) == JSON.stringify(mvTestObject)){
				that.logger.log(moduleName, 2, 'we found an output matching an mvTestObject!') 
				that.variants.outputs.splice(idx,1)
				callback()
			} else {
				that.deleteTestObjectIterator(mvTestObject, idx+1, phaseIdx, callback)
			}
		} else {
			that.deleteTestObjectIterator(mvTestObject, 0, phaseIdx+1, callback)
		}
	} else {
		that.logger.log(moduleName, 2, 'we found no matching mvTestObject!') 
		callback();
	}	
}

Spheron.prototype.updateThisSpheronFromId = function(originalId, newId, callback){
	var that = this
	that.updateThisSpheronFromIdIterator(0, originalId, newId, function(){
		callback()	
	})
}

Spheron.prototype.updateThisSpheronFromIdIterator = function(idx, originalId, newId, callback){
	var that = this
	if(that.io[idx]){
		if(that.io[idx].id == originalId){
			that.io.splice(idx,1)
			that.updateThisSpheronFromIdIterator(idx, originalId, newId, callback)
		} else if(that.io[idx].fromPort == originalId){
			that.io[idx].fromPort = newId
			that.updateThisSpheronFromIdIterator(idx+1, originalId, newId, callback)
		} else{
			that.updateThisSpheronFromIdIterator(idx+1, originalId, newId, callback)
		}
	} else {
		callback()
	}
}

Spheron.prototype.updateThisSpheronToId = function(originalId, newId, callback){
	var that = this
	that.updateThisSpheronToIdIterator(0, originalId, newId, function(){
		callback()	
	})
}

Spheron.prototype.updateThisSpheronToIdIterator = function(idx, originalId, newId, callback){
	var that = this
	if(that.io[idx]){
		if(that.io[idx].id == originalId){
			that.io.splice(idx,1)
			that.updateThisSpheronToIdIterator(idx, originalId, newId, callback)
		} else if(that.io[idx].toPort == originalId){
			that.io[idx].toPort = newId
			that.updateThisSpheronToIdIterator(idx+1, originalId, newId, callback)
		} else{
			that.updateThisSpheronToIdIterator(idx+1, originalId, newId, callback)
		}
	} else {
		callback()
	}
}

Spheron.prototype.findTestsContainingConnectionIdAndRemove = function(connectionId, callback){
 var that = this
 that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, 0, 0, function(){
 	callback()
 })
}

Spheron.prototype.findTestsContainingConnectionIdAndRemoveThemIterator = function(connectionId, idx, testPhase, callback){
	var that = this
	var deleteArray = []
	if(testPhase == 0){
		//inputs
		if(that.variants.inputs[idx]){
			if(that.variants.inputs[idx].original == connectionId || that.variants.inputs[idx].variants.indexOf(connectionId != -1)){
				//delete the variants
				that.variants.inputs.splice(idx,1)
				that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, idx, testPhase, callback)				
			} else {
				that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, idx+1, testPhase, callback)
			}
		} else {
			that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, 0, testPhase+1, callback)
		}
	} else if(testPhase == 1){
		//biases
		if(that.variants.biases[idx]){
			if(that.variants.biases[idx].original == connectionId || that.variants.biases[idx].variants.indexOf(connectionId != -1)){
				//delete the variants
				that.variants.biases.splice(idx,1)
				that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, idx, testPhase, callback)				
			} else {
				that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, idx+1, testPhase, callback)
			}
		} else {
			that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, 0, testPhase+1, callback)
		}
	} else if(testPhase == 2){
		//outputs
		if(that.variants.outputs[idx]){
			if(that.variants.outputs[idx].original == connectionId || that.variants.outputs[idx].variants.indexOf(connectionId != -1)){
				//delete the variants
				that.variants.outputs.splice(idx,1)
				that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, idx, testPhase, callback)				
			} else {
				that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, idx+1, testPhase, callback)
			}
		} else {
			that.findTestsContainingConnectionIdAndRemoveThemIterator(connectionId, 0, testPhase+1, callback)
		}
	} else {
		callback()
	}
}

module.exports = Spheron;