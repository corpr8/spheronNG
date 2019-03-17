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

		//survey input queue by signalId
		//i.e. signal 1234: [message, message]
		//note in the case of variated inputs, 

		//can we find a message for each input, with the same signalId - in the queue?
		//yes > is that.spheron.variantMaps.length>0
		//

		callback()
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
			that.logger.log(moduleName, 2, 'returning ' + sigIds.join(','))
			callback(sigIds)
		}
	},
	findInputNamesIterator: function(idx, inputNames, callback){
		var that = this
		idx = (idx) ? idx : 0
		inputNames = (inputNames) ? inputNames : []

		if(that.spheron.io[idx]){
			if(that.spheron.io[idx].type == "extInput" || that.spheron.io[idx].type == "input"){
				inputNames.push(that.spheron.io[idx].id)
			}
			that.findInputNamesIterator(idx+1, inputNames, callback)
		} else {
			callback(inputNames)
		}
	},
	getInputsGroupedBySigId: function(callback){
		var that = this
		that._getInputsGroupedBySigIdIterator([], 0, 0, function(result){
			that.logger.log(moduleName, 2, 'returning signals grouped by sigId: ' + JSON.stringify(result))
			callback(result)
		})
	},
	_getInputsGroupedBySigIdIterator: function(outputArray, idx, inputIdx, callback){
		var that = this
		if(that.spheron.inputMessageQueue[inputIdx]){
			that._searchArrayForSigId(outputArray, 0, that.spheron.inputMessageQueue[inputIdx].sigId, function(result){
				if(result = -1){
					var newMessage = {}
					newMessage[that.spheron.inputMessageQueue[inputIdx].sigId] = []
					newMessage[that.spheron.inputMessageQueue[inputIdx].sigId].push({
						"input": that.spheron.inputMessageQueue[inputIdx].toPort,
						"val": that.spheron.inputMessageQueue[inputIdx].val
					})
					outputArray.push(newMessage)
					that._getInputsGroupedBySigIdIterator(outputArray, idx, inputIdx+1, callback)
				} else {
					var newMessage = {}
					newMessage[that.spheron.inputMessageQueue[inputIdx].sigId] = []
					newMessage[that.spheron.inputMessageQueue[inputIdx].sigId].push({
						"input": that.spheron.inputMessageQueue[inputIdx].toPort,
						"val": that.spheron.inputMessageQueue[inputIdx].val
					})
					outputArray[result].push(newMessage)
					that._getInputsGroupedBySigIdIterator(outputArray, idx, inputIdx+1, callback)
				}
			})

			//iterate to next inputMessageQueue item...
		} else {
			callback(outputArray)
		}
	},
	_searchArrayForSigId: function(thisArray, arrayIdx, sigId, callback){
		var that = this
		if(thisArray[arrayIdx]){
			if(Object.keys(thisArray[arrayIdx])[0] == sigId){
				callback(arrayIdx)
			} else {
				that._searchArrayForSigId(thisArray, arrayIdx+1, sigId, callback)
			}
		} else {
			callback(-1)
		}
	}
}

module.exports = inputMessageQueueProcessor;
