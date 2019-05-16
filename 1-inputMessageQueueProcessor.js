var moduleName = 'inputMessageQueueProcessor'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var isJSON = require(appDir +'/isJSON.js')

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
			callback() 
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
				//Handle full signal matches

				/*
				* TODO: We must handle multi-variated of each case.
				* Initially, if we get a signal on a variated input, we should copy that to the others in the test.
				* Eventually - if we have a multivariated output, we should have a way of handling it somehow.
				* Problem being that we will have multiple singnals with the same value going into the same queue - which will wipe out the variations due to queue handling. 
				* Eventually we must modify queue handling to cope - i.e. if a signal comes through which is multi-variant, it fires as an OR with other singals in the queue of its sigId.
				*/

				/*handle straight out single signal matches in the input queue */
				that.logger.log(moduleName, 2, 'Running Phase 0')
				that.getFullSignalResultsAndRemoveFromInputQueue(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				case 1:

				//Handle saturated input queue - replacing missing inputs with old inputs if possible
				that.logger.log(moduleName, 2, 'Running Phase 1')
				that.getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueue(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)		
				})
			break;
				case 2:
				//Handle matches with historic results
				// where an input queue is saturated AND an input is consistently missing - backfill as 'static':
				that.logger.log(moduleName, 2, 'Running Phase 2')
				that.completeSignalsWithSuspectedDeadInputs(function(){
					that.processorPhaseIterator(phaseIdx +1, callback)
				})
			break;
				default:
				/*any post processing and callback*/
				that.logger.log(moduleName, 2, 'Calling back from inputMessageQueueProcessor to main runner')
				callback()
			break;
		}
	},
	inputMessageQueueIsSaturated: function(callback){
		var that = this
		if(that.spheron.settings){
			if(that.spheron.settings.maxInputQueueDepth){
				that.spheron.getInputMessageQueueLength(function(inputQueueLength){
					if(that.spheron.settings.maxInputQueueDepth < inputQueueLength){
						callback(true)
					} else {
						callback(false)
					}
				})
			} else {
				callback(false)
			}
		} else {
			callback(false)
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
	isVariatedInput: function (thisInputName, callback){
		var that = this 
		that.logger.log(moduleName, 4, 'called isVariatedInput')
		that.isVariatedInputIterator(thisInputName, 0, 0, function(result){
			that.logger.log(moduleName, 4, 'called back from isVariatedInput')
			callback(result)
		})
	},
	isVariatedInputIterator: function (thisInputName, variantIdx, variantItemIdx, callback){
		var that = this
		that.logger.log(moduleName, 4, 'called isVariatedInputIterator')
		if(that.spheron.variants){
			that.logger.log(moduleName, 4, 'isVariated we have variants')
			if(that.spheron.variants.inputs){
				that.logger.log(moduleName, 4, 'isVariated we have variants.inputs')
				if(that.spheron.variants.inputs[variantIdx]){
					if(that.spheron.variants.inputs[variantIdx].variants[variantItemIdx]){
						that.logger.log(moduleName, 4, 'isVariatedInputIterator: ' + that.spheron.variants.inputs[variantIdx].variants[variantItemIdx] + ' against: ' + thisInputName)
						if(that.spheron.variants.inputs[variantIdx].variants[variantItemIdx] == thisInputName){
							callback(true)
						} else {
							that.isVariatedInputIterator(thisInputName, variantIdx, variantItemIdx+1, callback)
						}
					} else {
						that.isVariatedInputIterator(thisInputName, variantIdx+1, 0, callback)
					}
				} else {
					callback(false)
				}
			} else {
				callback(false)
			}
		} else {
			callback(false)
		}
	},
	findInputNames: function(callback){
		var that = this
		//i.e. lets find the ones which are not a variation of another input
		that._findNonVariatedInputNamesIterator(0, [], function(foundNames){
			callback(foundNames)
		})
	},
	_findNonVariatedInputNamesIterator: function(idx, inputNames, callback){
		var that = this
		idx = (idx) ? idx : 0
		inputNames = (inputNames) ? inputNames : []

		if(that.spheron.io[idx]){
			if(that.spheron.io[idx].type == "extInput" || that.spheron.io[idx].type == "input"){
				that.isVariatedInput(that.spheron.io[idx].id, function(isVariant){
					if(isVariant == false){
						inputNames.push(that.spheron.io[idx].id)		
					}
					that._findNonVariatedInputNamesIterator(idx+1, inputNames, callback)
				})
			} else {
				that._findNonVariatedInputNamesIterator(idx+1, inputNames, callback)
			}
		} else {
			callback(inputNames)
		}
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
	getNonHistoricInputGroupedBySigId: function(callback){
		var that = this
		that.logger.log(moduleName, 4, 'called getNonHistoricInputGroupedBySigId')
		that._getNonHistoricInputGroupedBySigIdIterator([], 0, function(result){
			that.logger.log(moduleName, 4, 'returning non-historic signals grouped by sigId: ' + JSON.stringify(result))
			callback(result)
		})
	},
	_getNonHistoricInputGroupedBySigIdIterator: function(outputArray, inputIdx, callback){
		var that = this
		that.spheron.getInputMessageQueue(function(thisInputMessageQueue){
			if(thisInputMessageQueue[inputIdx]){
				that._searchArrayForSigId(outputArray, 0, thisInputMessageQueue[inputIdx].sigId, function(result){
					if(result != -1){
						that._searchHistoricInputForSigId(0, thisInputMessageQueue[inputIdx].sigId, function(resultH){
							if(resultH == -1){
								var newMessage = {
									"input": that.spheron.inputMessageQueue[inputIdx].toPort,
									"val": that.spheron.inputMessageQueue[inputIdx].val,
									"path": that.spheron.inputMessageQueue[inputIdx].path,
									"lessonId": that.spheron.inputMessageQueue[inputIdx].lessonId,
									"lessonIdx": that.spheron.inputMessageQueue[inputIdx].lessonIdx
								}

								that.logger.log(moduleName, 4, 'new message: ' + JSON.stringify(newMessage))
								that.logger.log(moduleName, 4, 'output array: ' + JSON.stringify(outputArray))

								outputArray[result][that.spheron.inputMessageQueue[inputIdx].sigId].push(newMessage)
								that._getNonHistoricInputGroupedBySigIdIterator(outputArray, inputIdx+1, callback)		
							} else {
								that._getNonHistoricInputGroupedBySigIdIterator(outputArray, inputIdx+1, callback)
							}
						}) 
					} else {
						that._searchHistoricInputForSigId(0, thisInputMessageQueue[inputIdx].sigId, function(resultH){
							if(resultH == -1){
								var newMessage = {}
								newMessage[that.spheron.inputMessageQueue[inputIdx].sigId] = []
								newMessage[that.spheron.inputMessageQueue[inputIdx].sigId].push({
									"input": that.spheron.inputMessageQueue[inputIdx].toPort,
									"val": that.spheron.inputMessageQueue[inputIdx].val,
									"path": that.spheron.inputMessageQueue[inputIdx].path,
									"lessonId": that.spheron.inputMessageQueue[inputIdx].lessonId,
									"lessonIdx": that.spheron.inputMessageQueue[inputIdx].lessonIdx
								}) 
								outputArray.push(newMessage)
								that._getNonHistoricInputGroupedBySigIdIterator(outputArray, inputIdx+1, callback)
							} else {
								that._getNonHistoricInputGroupedBySigIdIterator(outputArray, inputIdx+1, callback)
							}
						})
					}
				})
			} else {
				callback(outputArray)
			}
		})
	},
/*	getSignalsWithConsistentGapsFromSaturatedInputQueue: function(callback){
		//	Where an input queue is saturated and there is an input which consistently fails to fire (i.e. its absent)
		//	=> we should fire the sigId but mark the input as 'static'. Further down the line this should cause decay > bias
		var that = this
		that.logger.log(moduleName, 2, 'getSignalsWithConsistentGapsFromSaturatedInputQueue called')
		process.exit()

	},*/
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
	_searchHistoricInputForSigId: function(arrayIdx, sigId, callback){
		var that = this
		/*
		* TODO: activtion history should come from a get method
		*/
		if(that.spheron.activationHistory){
			if(that.spheron.activationHistory[arrayIdx]){
				that.logger.log(moduleName, 4, 'historic array value: ' + that.spheron.activationHistory[arrayIdx] + ' candidate sigId: ' + sigId)
				if(that.spheron.activationHistory[arrayIdx] == sigId){
					that.logger.log(moduleName, 4, 'Match found')
					callback(arrayIdx)
				} else {
					that._searchHistoricInputForSigId(arrayIdx+1, sigId, callback)
				}
			} else {
				that.logger.log(moduleName, 4, 'end of array. value not found')
				callback(-1)
			}
		} else {
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
			that.getNonHistoricInputGroupedBySigId(function(inputGroupedBySigId){
				/*
				* Activation Quue Candidates:
				* 1: We have all input for a given signalId and that signalId is not historic
				* 2: We can complete a given non historic signal with a historic input/singalId
				* 3: The input queue is saturated and one or more inputs is consistently missing (insert static holder)
				*/
				that._searchForFullyCompleteSignals(foundInputs,inputGroupedBySigId,function(completedSignals){
					that.logger.log(moduleName, 4, 'found the following complete signals: ' + JSON.stringify(completedSignals))
						that._removeSigIDsFromInputQueue(completedSignals, function(){
							/*TODo:*/ 
							that.logger.log(moduleName, 4, 'stuff removed from input Queue')
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
			that.spheron.pushSignalToActivationQueue(signals[signalIdx], function(){
				that._pushSignalsToActivationQueueIterator(signalIdx+1, signals,callback)
			})
		} else {
			callback()
		}
	},
	_removeSigIDsFromInputQueue: function(sigIds, callback){
		var that = this
		that.logger.log(moduleName, 2, 'removeSigIds is: ' + JSON.stringify(sigIds[0]))
		that.logger.log(moduleName, 2, 'isJSON: ' + isJSON(JSON.stringify(sigIds[0])))
		if(isJSON(JSON.stringify(sigIds[0])) == true){
			that.logger.log(moduleName, 2, 'removing: sigids from inputqueue - using signal objects not an array of signalIds')
			that._removeSigIDsFromInputQueueIterator(0, 0, sigIds, function(){
				callback()
			})	
		} else {
			that.logger.log(moduleName, 2, 'removing: sigids from inputqueue by signalId strings: ' + sigIds.join(','))
			that._removeSigIDStringsFromInputQueueIterator(0, 0, sigIds, function(){
				callback()
			})
		}
	},
	_removeSigIDStringsFromInputQueueIterator: function(sigIdx, inputQueueIdx, sigIds, callback){
	  var that = this
	  that.logger.log(moduleName, 4, '*** sigIds ' + sigIds.join(','))
	  
	  if(sigIds[sigIdx]){
	  	that.spheron.getInputMessageQueue(function(thisInputMessageQueue){

			if(thisInputMessageQueue[inputQueueIdx]){	
				that.logger.log(moduleName, 4, '*** got here ')
				that.logger.log(moduleName, 4, '*** that.spheron.inputMessageQueue[inputQueueIdx].sigId ' + thisInputMessageQueue[inputQueueIdx].sigId + ' versus sigIds[sigIdx]: ' + sigIds[sigIdx])
				that.logger.log(moduleName, 4, '*** equality: ' + (thisInputMessageQueue[inputQueueIdx].sigId == sigIds[sigIdx]))
		  		if(thisInputMessageQueue[inputQueueIdx].sigId == sigIds[sigIdx]){

		  			//delete this line...
		  			//do our work then... - note, we don't need to increment inputQueueIdx if we delete something... 
		  			that.logger.log(moduleName, 4, '*** removing: ' + JSON.stringify(thisInputMessageQueue[inputQueueIdx]) + ' from the input queue')
		  			that.spheron.removeItemFromInputQueueByIdx(inputQueueIdx, function(){
			  			//that.spheron.inputMessageQueue.splice(inputQueueIdx, 1)
			  			that._removeSigIDStringsFromInputQueueIterator(sigIdx, inputQueueIdx, sigIds, callback)		
		  			})
		  		} else {
		  			that._removeSigIDStringsFromInputQueueIterator(sigIdx, inputQueueIdx+1, sigIds, callback)	
		  		}
		  	} else {
		  		that._removeSigIDStringsFromInputQueueIterator(sigIdx +1, 0, sigIds, callback)
		  	}
	  	})
	  } else {
	  	//we have iterated all of the sigIds to take out.
	  	callback()
	  }
	},
	_removeSigIDsFromInputQueueIterator: function(sigIdx, inputQueueIdx, sigIds, callback){
	  var that = this
	  that.logger.log(moduleName, 4, '*** sigIds ' + JSON.stringify(sigIds))

	  if(sigIds[sigIdx]){
	  	that.logger.log(moduleName, 4, '*** we have a valid sigIds[sigIdx]')
	  	that.spheron.getInputMessageQueue(function(thisInputMessageQueue){
			if(thisInputMessageQueue[inputQueueIdx]){ 
		  		that.logger.log(moduleName, 4, '*** that.spheron.inputMessageQueue[inputQueueIdx].sigId ' + thisInputMessageQueue[inputQueueIdx].sigId + ' versus Object.keys(sigIds[sigIdx])[0]: ' + Object.keys(sigIds[sigIdx])[0])
		  		that.logger.log(moduleName, 4, '*** equality: ' + (thisInputMessageQueue[inputQueueIdx].sigId ==  Object.keys(sigIds[sigIdx])[0]))
		  		if(thisInputMessageQueue[inputQueueIdx].sigId == Object.keys(sigIds[sigIdx])[0]){
		  			that.logger.log(moduleName, 4, '*** we are deleting: ' + thisInputMessageQueue[inputQueueIdx].sigId);
		  			//delete this line...
		  			//do our work then... - note, we don't need to increment inputQueueIdx if we delete something... 

		  			that.spheron.removeItemFromInputQueueByIdx(inputQueueIdx, function(){
			  			//(that.spheron.inputMessageQueue).splice(inputQueueIdx, 1);

			  			//input queue is now:
			  			//that.spheron.getInputMessageQueue(function(thisInputMessageQueue){
			  				//that.logger.log(moduleName, 4, '*** input message queue is now: ' + JSON.stringify(thisInputMessageQueue))
			  				that._removeSigIDsFromInputQueueIterator(sigIdx, inputQueueIdx, sigIds, callback)
			  			//})

		  			})
		  		} else {
		  			that._removeSigIDsFromInputQueueIterator(sigIdx, inputQueueIdx+1, sigIds, callback)	
		  		}
		  	} else {
		  		that._removeSigIDsFromInputQueueIterator(sigIdx +1, 0, sigIds, callback)
		  	}
	  	})
	  } else {
	  	//we have iterated all of the sigIds to take out.
	  	//setTimeout(function(){
	  	//	callback()
	  	//},1)
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
		var that = this
		that.logger.log(moduleName, 2, 'getInputMessageQueue has been called')
		that.spheron.getInputMessageQueue(function(thisMessageQueue){
			that.logger.log(moduleName, 4, 'getInputMessageQueue returning ' + JSON.stringify(thisMessageQueue))
			callback(thisMessageQueue)
		})
	},
	getActivationQueue: function(callback){
		var that = this
		that.logger.log(moduleName, 2, 'getActivationQueue has been called') 
		that.spheron.getActivationQueue(function(thisMessageQueue){
			that.logger.log(moduleName, 4, 'getActivationQueue returning ' + JSON.stringify(thisMessageQueue))
			callback(thisMessageQueue)
		})
	},
	_getConsistentlyIncompleteInput: function(callback){
		var that = this
		that.logger.log(moduleName, 2, '_getConsistentlyIncompleteInput has been called')
		that.findInputNames(function(foundInputs){
			that._getConsistentlyIncompleteInputIterator(0, foundInputs, function(missingInputs){
				that.logger.log(moduleName, 2, '_getConsistentlyIncompleteInput returning ' + missingInputs.join(','))
				callback(missingInputs)
			})
		})
		
	},
	_getConsistentlyIncompleteInputIterator: function(inputQueueIdx, missingInputs, callback){
		var that = this
		that.spheron.getInputMessageQueue(function(thisMessageQueue){
			if(thisMessageQueue[inputQueueIdx]){
				if(missingInputs.indexOf(thisMessageQueue[inputQueueIdx].toPort) != -1){
					missingInputs.splice(missingInputs.indexOf(thisMessageQueue[inputQueueIdx].toPort) ,1)
				}
				that._getConsistentlyIncompleteInputIterator(inputQueueIdx +1, missingInputs, callback)
			} else {
				callback(missingInputs)
			}
		})
	},
	getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueue: function(callback){
		var that = this
		that.logger.log(moduleName, 4, 'getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueue has been called')
		that.inputMessageQueueIsSaturated(function(saturated){
			if(saturated){
				that.findInputNames(function(inputNames){
					that.getNonHistoricInputGroupedBySigId(function(nonHistoricSignalsGroupedBySigId){
						that.logger.log(moduleName, 4, 'nonHistoricSignalsGroupedBySigId: ' + JSON.stringify(nonHistoricSignalsGroupedBySigId))
						that.getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueueIterator(0, nonHistoricSignalsGroupedBySigId, inputNames, function(historicallyCompleteSignals){
							/*
							* fnished iterating, we should callback as we are all done
							*/ 
							callback(null)
						})	
					})
				})	
			} else {
				that.logger.log(moduleName, 2, 'not saturated, calling back')
				callback()
			}
		})
	},
	getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueueIterator: function(signalIdx, nonHistoricSignalsGroupedBySigId, inputNames, callback){
		var that = this
		that.logger.log(moduleName, 2, 'getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueueIterator has been called')
		
		if(nonHistoricSignalsGroupedBySigId[signalIdx]){
			that.logger.log(moduleName, 4, 'non historic signal grouped by SignalId:' + JSON.stringify(nonHistoricSignalsGroupedBySigId[signalIdx]))
			/*
			* now find if we the missing inputs and work out if we can complete those from historic signals...
			*/
			that._establishInputsMissingFromSignalGrouping(nonHistoricSignalsGroupedBySigId[signalIdx], 0, inputNames, [], function(missingInputs){
				that.logger.log(moduleName, 4, 'missing inputs:' + missingInputs.join(','))
				that.findHistoricInputNames(function(historicInputs){
					that.logger.log(moduleName, 4, 'historic inputs:' + historicInputs.join(','))
					process.exitCode = 1
					that.aSubsetOfB(missingInputs, historicInputs, function(result){
						if(result){
							that.logger.log(moduleName, 4, 'missing inputs ARE a subset of historic inputs - we CAN do historic activation!!!')

							/*
							* complete this signal by removing elements from historic queue and push to activation queue
							*/
							that._completeSignalWithHistoricComponentsAndRemoveFromInputQueue(nonHistoricSignalsGroupedBySigId[signalIdx], missingInputs, function(backfilledSignal){
								that.logger.log(moduleName, 4, 'pushing to activation queue: ' + JSON.stringify(backfilledSignal))
								that._pushSignalsToActivationQueue([backfilledSignal], function(){
									//rather than calling back, start getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueue again
									that.getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueue(callback)
								})
							})
						} else {
							that.logger.log(moduleName, 4, 'missing inputs are not a subset of historic inputs')
							that.getHistoricallyCompletedSignalsAndRemoveFromSaturatedInputQueueIterator(signalIdx +1, nonHistoricSignalsGroupedBySigId, inputNames, callback)
						}
					})
				})				
			})
		} else {
			//process.exitCode = 1
			callback()
		}
	},
	_completeSignalWithHistoricComponentsAndRemoveFromInputQueue: function(thisSignal, thisMissingInputs, callback){
		var that = this
		that.logger.log(moduleName, 2, 'called: _completeSignalWithHistoricComponents')
		that.logger.log(moduleName, 2, '*** thisSignal is: ' + Object.keys(thisSignal)[0])
		//remove thisSignal Id from the input queue. 
		that._removeSigIDsFromInputQueue([thisSignal], function(){
			//complete this signal by adding parts from historic signals until we are complete
			that.backFillSignal(thisSignal, thisMissingInputs, function(thisBackfilledSignal){
				//remove each applicable signal from the historic queue
				//callback with the completed signal
				that.logger.log(moduleName, 2, 'Backfilled signal is: ' + JSON.stringify(thisBackfilledSignal))
				//process.nextTick(function(){
				 	callback(thisBackfilledSignal)	
				//})
				
			})
		})
	},
	backFillSignal: function(thisSignal, thisMissingInputs, callback){
		var that = this
		that._backFillIterator(0, thisSignal, thisMissingInputs, function(thisBackfilledSignal){
			callback(thisBackfilledSignal)
		})
	},
	_backFillIterator: function(inputIdx, thisSignal, thisMissingInputs, callback){
		var that = this
		if(thisMissingInputs.length > 0){
			that.spheron.getInputMessageQueue(function(thisMessageQueue){
				if(thisMessageQueue[inputIdx]){
					if(thisMissingInputs[0] == thisMessageQueue[inputIdx].toPort){
						var newSignalElement = {
							"input" : thisMessageQueue[inputIdx].toPort,
							"val" : thisMessageQueue[inputIdx].val,
							"path" : thisMessageQueue[inputIdx].path,
							"lessonId": thisMessageQueue[inputIdx].lessonId,
							"lessonIdx": thisMessageQueue[inputIdx].lessonIdx
						}
						thisSignal[Object.keys(thisSignal)[0]].push(newSignalElement)
						thisMissingInputs.splice(0,1)
						that.spheron.removeItemFromInputQueueByIdx(inputIdx, function(){
							that._backFillIterator(0, thisSignal, thisMissingInputs, callback)		
						})
					} else{
						that._backFillIterator(inputIdx+1, thisSignal, thisMissingInputs, callback)
					}
				} else {
					that._backFillIterator(0, thisSignal, thisMissingInputs, callback)
				}	
			})
		} else {
			callback(thisSignal)
		}
	},
	aSubsetOfB:function(arrayA, arrayB, callback){
		var that = this
		that._aSubsetOfBIterator(arrayA, arrayB, 0, function(result){
			callback(result)
		})
	},
	_aSubsetOfBIterator:function(arrayA, arrayB, aIdx, callback){
		var that = this
		if(arrayA[aIdx]){
			if(arrayB.indexOf(arrayA[aIdx]) == -1){
				callback(false)
			} else {
				that._aSubsetOfBIterator(arrayA, arrayB, aIdx+1, callback)
			}
		} else {
			callback(true)
		}
	},
	_establishInputsMissingFromSignalGrouping: function(nonHistoricSignalsGroupedBySigId, nonHistoricSignalsGroupedBySigIdIdx, inputNames, resultantArray, callback){
		var that = this
		resultantArray = (resultantArray.length != 0) ? resultantArray : [...inputNames] //shallow clone array in es6
		if(nonHistoricSignalsGroupedBySigId[Object.keys(nonHistoricSignalsGroupedBySigId)[0]][nonHistoricSignalsGroupedBySigIdIdx]){
			var thisObject = nonHistoricSignalsGroupedBySigId[Object.keys(nonHistoricSignalsGroupedBySigId)[0]][nonHistoricSignalsGroupedBySigIdIdx]
			that.logger.log(moduleName, 4, 'this object is:' +JSON.stringify(thisObject))
			that.logger.log(moduleName, 4, 'this object index:' +resultantArray.indexOf(thisObject.input))
			if(resultantArray.indexOf(thisObject.input) != -1){
				resultantArray.splice(resultantArray.indexOf(thisObject.input),1)
			}
			that._establishInputsMissingFromSignalGrouping(nonHistoricSignalsGroupedBySigId, nonHistoricSignalsGroupedBySigIdIdx+1, inputNames, resultantArray, callback)
		} else {
			callback(resultantArray)
		}
	},
	findHistoricInputNames: function(callback){
		var that = this
		that._findHistoricInputNameIterator(0, [], function(foundInputs){
			callback(foundInputs)
		})
	},
	_findHistoricInputNameIterator: function(inputQueueIdx, resultantArray, callback){
		var that = this
		if(that.spheron.inputMessageQueue[inputQueueIdx]){
			that._searchHistoricInputForSigId(0, that.spheron.inputMessageQueue[inputQueueIdx].sigId, function(resultH){
				if(resultH != -1){
					if(resultantArray.indexOf(that.spheron.inputMessageQueue[inputQueueIdx].toPort) == -1){
						resultantArray.push(that.spheron.inputMessageQueue[inputQueueIdx].toPort)
					}
					that._findHistoricInputNameIterator(inputQueueIdx+1, resultantArray, callback)
				} else {
					that._findHistoricInputNameIterator(inputQueueIdx+1, resultantArray, callback)
				}
			})
		} else {
			callback(resultantArray)
		}
	},
	completeSignalsWithSuspectedDeadInputs: function(callback){
		var that = this
		that.logger.log(moduleName, 2, 'called: completeSignalsWithSuspectedDeadInputs')
		that.inputMessageQueueIsSaturated(function(saturated){
			if(saturated){
				that.spheron.getInputMessageQueueLength(function(thisQueueLength){
					that._getConsistentlyIncompleteInput(function(consistentlyIncompleteInputs){
						that.get
						that.logger.log(moduleName, 2, 'consistently incomplete inputs:' + consistentlyIncompleteInputs.join(','))
						that.logger.log(moduleName, 2, 'queue length:' + thisQueueLength)
						that.logger.log(moduleName, 2, 'queue length threshold:' + that.spheron.settings.maxInputQueueDepth)

						//now find the input signalIds for each of the messages in the queue 
						that.getNonHistoricInputGroupedBySigId(function(nonHistoricSignalsGroupedBySigId){
							that.logger.log(moduleName, 4, 'non historic signal queue is:' + JSON.stringify(nonHistoricSignalsGroupedBySigId)) 
							
							//inject a completed 'static' signal for each nonHistoric
							that._injectStaticComponentIterator(0, nonHistoricSignalsGroupedBySigId, consistentlyIncompleteInputs,0 , function(){


								//Very test - be carful and test this...
								that.getFullSignalResultsAndRemoveFromInputQueue(function(){
									callback()
								})


							})
						})
					})	
				})
			} else {
				that.logger.log(moduleName, 4, 'not saturated, calling back')
				callback()
			}
		})
	},
	_injectStaticComponentIterator: function(signalIdx, theseSignals, missingInputs, missingInputsIdx, callback){
		var that = this
		if(theseSignals[signalIdx]){
			var thisSignalId = Object.keys(theseSignals[signalIdx])[0]
			that.logger.log(moduleName, 4, 'this signalId:' + thisSignalId)
			
			//{"lessonId" : "whatIsAnd", "toPort" : "input1", "path" : "input1", "testIdx": 0, "val": 1, "sigId" : "1000" },
			if(missingInputs[missingInputsIdx]){
				var newMessage = {
					toPort: missingInputs[missingInputsIdx],
					path : missingInputs[missingInputsIdx],
					val: 'static',
					sigId: thisSignalId
				}

				that.spheron.pushSignalToInputMessageQueue(newMessage, function(){
					that._injectStaticComponentIterator(signalIdx, theseSignals, missingInputs, missingInputsIdx+1, callback)
				})
			} else {
				that._injectStaticComponentIterator(signalIdx+1, theseSignals, missingInputs, 0, callback)
			}
		} else {
			callback()
		}
	},
	getIO: function(callback){
		var that = this
		that.spheron.getIO(function(thisIO){
			callback(thisIO)
		})
	}
}

module.exports = inputMessageQueueProcessor;
