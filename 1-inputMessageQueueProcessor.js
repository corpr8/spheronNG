var moduleName = 'inputMessageQueueProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

/*
* Module to handle the input message queue
*/ 

var inputMessageQueueProcessor = {
	spheron: null,
	logger: null,
	init: function(thisSpheron, logger, callback){
		var that = this
		that.logger = logger
		that.spheron = thisSpheron
		that.logger.log(moduleName, 2,'init')
		
		
		if(!that.spheron.tdd){
			that.logger.log(moduleName, 2, 'Module running in Production mode')
			that.processPhases(function(){
				callback(that.spheron)
			}) 
		} else {
			that.logger.log(moduleName, 2, 'Module running in TDD mode')
		}
		callback()
	},
	processPhases: function(){
 		var that = this
 		that.processorPhaseIterator(0, function(){
 			callback()
 		})
	},
	processorPhaseIterator: function(phaseIdx, callback){
		var that = this
		switch(phaseIdx){
			case 0:
				//Handle full signal matches
				that.getFullSignalResultsAndRemoveFromInputQueue(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				case 1:
				//Handle matches with historic results
				that.processorPhaseIterator(phaseIdx +1, callback)
					
			break;
				case 2:
				//Handle saturated input queue - where an input might consistently not respond and therefore pass it in the 'static' state
				//and decay that connections 'life' value.
					
			break;
				default:
				callback()
			break;
		}
	},
	getSignalIdsFromInputQueue: function(idx, sigIds, callback){
		var that = this
		idx = (idx) ? idx : 0
		sigIds = (sigIds) ? sigIds : []

		if(that.spheron.inputMessageQueue[idx]){
			var foundId = false
			for(var v=0;v<sigIds.length;v++){
				if(sigIds[v] == that.spheron.inputMessageQueue[idx].sigId){
					foundId = true
				}
			}
			if(!foundId){
				sigIds.push(that.spheron.inputMessageQueue[idx].sigId)
			}

			that.getSignalIdsFromInputQueue(idx +1, sigIds, callback)
		} else {
			that.logger.log(moduleName, 4, 'returning ' + sigIds.join(','))
			callback(sigIds)
		}
	},
	findInputNames: function(callback){
		var that = this
		that._findInputNamesIterator(0, [], function(foundNames){
			callback(foundNames)
		})
	},
	_findInputNamesIterator: function(idx, inputNames, callback){
		var that = this
		idx = (idx) ? idx : 0
		inputNames = (inputNames) ? inputNames : []

		if(that.spheron.io[idx]){
			if(that.spheron.io[idx].type == "extInput" || that.spheron.io[idx].type == "input"){
				inputNames.push(that.spheron.io[idx].id)
			}
			that._findInputNamesIterator(idx+1, inputNames, callback)
		} else {
			callback(inputNames)
		}
	},
	getInputGroupedBySigId: function(callback){
		var that = this
		that._getInputGroupedBySigIdIterator([], 0, function(result){
			that.logger.log(moduleName, 2, 'returning signals grouped by sigId: ' + JSON.stringify(result))
			callback(result)
		})
	},
	_getInputGroupedBySigIdIterator: function(outputArray, inputIdx, callback){
		var that = this
		if(that.spheron.inputMessageQueue[inputIdx]){
			that._searchArrayForSigId(outputArray, 0, that.spheron.inputMessageQueue[inputIdx].sigId, function(result){
				if(result != -1){
					var newMessage = {
						"input": that.spheron.inputMessageQueue[inputIdx].toPort,
						"val": that.spheron.inputMessageQueue[inputIdx].val,
						"path": that.spheron.inputMessageQueue[inputIdx].path
					}

					that.logger.log(moduleName, 4, 'new message: ' + JSON.stringify(newMessage))
					that.logger.log(moduleName, 4, 'output array: ' + JSON.stringify(outputArray))

					outputArray[result][that.spheron.inputMessageQueue[inputIdx].sigId].push(newMessage)
					that._getInputGroupedBySigIdIterator(outputArray, inputIdx+1, callback)
				} else {
					
					var newMessage = {}
					newMessage[that.spheron.inputMessageQueue[inputIdx].sigId] = []
					newMessage[that.spheron.inputMessageQueue[inputIdx].sigId].push({
						"input": that.spheron.inputMessageQueue[inputIdx].toPort,
						"val": that.spheron.inputMessageQueue[inputIdx].val,
						"path": that.spheron.inputMessageQueue[inputIdx].path
					}) 
					outputArray.push(newMessage)
					that._getInputGroupedBySigIdIterator(outputArray, inputIdx+1, callback)
				}
			})
		} else {
			callback(outputArray)
		}
	},
	getSignalsWithConsistentGapsFromSaturatedInputQueue: function(callback){
		/*
		*	Where an input queue is saturated and there is an input which consistently fails to fire (i.e. its absent)
		*	=> we should fire the sigId but mark the input as 'static'. Further down the line this should cause decay > bias
		*/
		var that = this
		that.logger.log(moduleName, 2, 'getSignalsWithConsistentGapsFromSaturatedInputQueue called')
		/* TODO: this whole logic chain... */
		process.exit()

	},
	_searchArrayForSigId: function(thisArray, arrayIdx, sigId, callback){
		var that = this
		if(thisArray[arrayIdx]){
			that.logger.log(moduleName, 4, 'array value: ' + Object.keys(thisArray[arrayIdx])[0] + ' sigId: ' + sigId)
			if(Object.keys(thisArray[arrayIdx])[0] == sigId){
				that.logger.log(moduleName, 4, 'Match found')
				callback(arrayIdx)
			} else {
				that._searchArrayForSigId(thisArray, arrayIdx+1, sigId, callback)
			}
		} else {
			that.logger.log(moduleName, 4, 'end of array. value not found')
			callback(-1)
		}
	},
	getFullSignalResultsAndRemoveFromInputQueue: function(callback){
		/*
		* Look at the input que and remove any where the full input set exists for a signalId (starting with the lowest signalId)
		* 1: If the display is saturated, and an input both fails to appear in the list and also doesnt appear for any historic signals,
		* => pass it with a value of 'static'
		* Upon each activation, an input which receives a static signal will have its 'life' parameter slashed in half.
		* if the input receives a historic signal (i.e. a 2nd order signal), reset the counter.
		* if the counter hits a threshold (i.e. 0.001), change the input into a bias (we could also search for any outputs pointing at the input, but I am not sure this is necessary)
		* while activating, static means use the current value on that input and don't update it (much like a bias)
		* Also, QQ: should 'Dead' connections back propogate?
		*/

		
		var that = this
		that.findInputNames(function(foundInputs){
			that.getInputGroupedBySigId(function(inputGroupedBySigId){
				/*
				* Activation Quue Candidates:
				* 1: We have all input for a given signalId and that signalId is not historic
				* 2: We can complete a given non historic signal with a historic input/singalId
				* 3: The input queue is saturated and one or more inputs is consistently missing (insert static holder)
				*/
				that._searchForFullyCompleteSignals(foundInputs,inputGroupedBySigId,function(completedSignals){
					that.logger.log(moduleName, 2, 'found the following complete signals: ' + JSON.stringify(completedSignals))
						that._removeSigIDsFromInputQueue(completedSignals, function(){
							/*TODo:*/ 
							that.logger.log(moduleName, 2, 'stuff removed from input Queue')
							that._pushSignalsToActivationQueue(completedSignals, function(){
								callback(completedSignals)	
						})
					})
				})
			})
		})
	},
	_pushSignalsToActivationQueue: function(signals, callback){
		var that = this 
		that._pushSignalsToActivationQueueIterator(0, signals,function(){
			callback()
		})
	},
	_pushSignalsToActivationQueueIterator: function(signalIdx, signals,callback){
		 var that = this
		signalIdx = (signalIdx) ? signalIdx : 0
		if(signals[signalIdx]){
			that.spheron.activationQueue.push(signals[signalIdx]) 
			that._pushSignalsToActivationQueueIterator(signalIdx+1, signals,callback)
		} else {
			callback()
		}
	},
	_removeSigIDsFromInputQueue: function(sigIds, callback){
		var that = this
		that._removeSigIDsFromInputQueueIterator(0, 0, sigIds, function(){
			callback()
		})
	},
	_removeSigIDsFromInputQueueIterator: function(sigIdx, inputQueueIdx, sigIds, callback){
		var that = this
	  if(sigIds[sigIdx]){
	  	if(that.spheron.inputMessageQueue[inputQueueIdx]){
	  		if(that.spheron.inputMessageQueue[inputQueueIdx].sigId == Object.keys(sigIds[sigIdx])[0]){
	  			//delete this line...
	  			//do our work then... - note, we don't need to increment inputQueueIdx if we delete something... 
	  			that.spheron.inputMessageQueue.splice(inputQueueIdx, 1)
	  			that._removeSigIDsFromInputQueueIterator(sigIdx, inputQueueIdx, sigIds, callback)	
	  		} else {
	  			that._removeSigIDsFromInputQueueIterator(sigIdx, inputQueueIdx+1, sigIds, callback)	
	  		}
	  	} else {
	  		that._removeSigIDsFromInputQueueIterator(sigIdx +1, 0, sigIds, callback)
	  	}
	  } else {
	  	//we have iterated all of the sigIds to take out.
	  	callback()
	  }
	},
	_searchForFullyCompleteSignals: function(foundInputs, inputGroupedBySigId, callback){
		var that = this
		that._searchForCompleteSignalsIterator(foundInputs, inputGroupedBySigId, 0, [], function(completeSignals){
			callback(completeSignals)
		})
	},
	_searchForCompleteSignalsIterator: function(foundInputs, inputGroupedBySigId, signalIdx, completeSignals, callback){
		var that = this
		//loop each of the signals in the inputGroupedBySigId
		if(inputGroupedBySigId[signalIdx]){
			var thisSignalInputArray = inputGroupedBySigId[signalIdx][ Object.keys(inputGroupedBySigId[signalIdx])[0] ]
			//iterate through foundInputs and make sure each one appears in thisSignalInput

			//search to see if all inputs are there
			//if so, add to completeSignals	

			that._searchForFoundInput(foundInputs, 0, thisSignalInputArray, 0, function(inputsComplete){
				if(inputsComplete){
					completeSignals.push(inputGroupedBySigId[signalIdx])
				}
				that._searchForCompleteSignalsIterator(foundInputs, inputGroupedBySigId, signalIdx+1, completeSignals, callback)
			})
		} else {
			callback(completeSignals)
		}

	},
	_searchForFoundInput: function(foundInputs, foundInputIdx, thisSignalInputArray, thisSignalInputArrayIdx, callback){
		var that = this
		if(foundInputs[foundInputIdx]){
			if(thisSignalInputArray[thisSignalInputArrayIdx]){
				if(thisSignalInputArray[thisSignalInputArrayIdx].input == foundInputs[foundInputIdx]){
					//we found the input, iterate
					that._searchForFoundInput(foundInputs, foundInputIdx+1, thisSignalInputArray, 0, callback)
				} else {
					that._searchForFoundInput(foundInputs, foundInputIdx, thisSignalInputArray, thisSignalInputArrayIdx+1, callback)
				} 
			} else {
				//we didn't find this foundInput in this signal Array item
				callback(false)
			}
		} else {
			//we don't have any more inputs to search for so this is a good result.
			callback(true)
		}
	},
	getInputMessageQueue: function(callback){
		//BROKEN
		var that = this
		that.logger.log(moduleName, 2, 'getInputMessageQueue has been called')
		that.logger.log(moduleName, 2, 'getInputMessageQueue returning ' + that.spheron.inputMessageQueue)
		callback(that.spheron.inputMessageQueue)
	}
	,
	getActivationQueue: function(callback){
		try{
			//BROKEN  
			var that = this
			that.logger.log(moduleName, 2, 'getActivationQueue has been called')
			that.logger.log(moduleName, 2, 'getActivationQueue returning ' + that.spheron.inputMessageQueue)
			callback(that.spheron.activationQueue)	
		} catch(Err){
			console.log(Err)
		}
	}
}

module.exports = inputMessageQueueProcessor;
