/*
* Module to handle aggregating data for analytical consumption
*/  

var averagingAnalyticModule = {
	accuracyDP: 2,
	cascadePoints: [6,9,5,9,5,3,6,3,11,9,10000000],
	cascadeLabels: [
		["1sec","2sec","3sec","4sec","5sec","6sec"],
		["12sec","18sec","24sec","30sec","36sec","42sec","48sec","54sec", "1m"],
		["2min","3min","4min","5min","6min"],
		["12min","18min","24min","30min","36min","42min","48min","54min", "1hr"],
		["2hr", "3hr", "4hr", "5hr", "6hr"],
		["12hr","18hr","1day"],
		["2d","3d","4d","5d","6d","1wk"],
		["2wk","3wk","1mo"],
		["2mo","3mo","4mo","5mo","6mo","7mo","8mo","9mo","10mo","11mo","1y"],
		["2y","3y","4y","5y","6y","7y","8y","9y","1dec"],
		["dec"]
	],
	pushDataToStore: function(newData, store, callback){
		var that = this
		/*
		* store DataModel: {
		*	lastDataEvent: date in seconds,
		* 	store: [
		*    raw data is filled in at up to second intervals. more frequet will overwrite the current second.
		*    once we hit the register limit, we average the overflow and cascade that to the next level up.
		*    [up to 12 second raw data values] 6 * 1s = 6s, 6s overflow
		*    [up to 20 6 second averages] 10 * 6secs = 1 min, 10sec overflow.
		*    [up to 12 1 minute averages] 6 * 1 minute = 6 minutes, 6 min overflow
		*    [up to 20 6 minute averages] 10 * 6 mins = 1hr, 1hr overflow
		*    [up to 12 1 hr averages] 6 * 1hr = 6hrs, 6hr overflow
		*    [up to 8 6hr averages] 4 * 6hr = 1 day, 1 day overflow
		*    [up to 14 days averages] 7 * 1day = 1 week, 1 week overflow
		*    [up to 8 week averages] 4 * 1week = 1 month, 1 month overflow
		*    [up to 24 month averages] 12 * 1month = 1year, 1 year overflow
		*    [up to 20 year averages] 10 * 1year = 1 decade, 1 decade overflow
		*   ]
		* }
		*/
		var now = Math.floor(new Date().getTime() / 1000) 
		if(!store || (store === null)){
			console.log('store didnt exist')
			//setup a new store
			store = {}
			store.lastDataEvent = now
			store.store = [[newData]]
			callback(store)
		} else {
			if(!store.lastDataEvent){
				store.lastDataEvent = now
			}
			if(store.lastDataEvent < now){
				if(store.lastDataEvent < (now - 100)){
					//too old to care
					//unshift the new value onto the beginning of the array
					store.lastDataEvent = now
					store.store[0].unshift(newData)
					that.cascadeIterator(0, store, function(updatedStore){
						//callback with the cascaded store...
						that.pushDataToStore(newData, updatedStore, callback)
					})
				} else {
					//unshift the new value onto the beginning of the array
					store.lastDataEvent += 1
					store.store[0].unshift(newData)
					that.cascadeIterator(0, store, function(updatedStore){
						//callback with the cascaded store...
						that.pushDataToStore(newData, updatedStore, callback)
					})	
				}

				
			} else {
				//we support 1 second increment minimum so just overwrite the value in position 0 of the store
				store.store[0][0] = newData
				callback(store)
			}
		}
	},
	cascadeIterator: function(idx, store, callback){
		var that = this
		//console.log('called iterator: ' + idx)
		if(store.store[idx]){
			//if the length of this store element is > than 2* its corresponding cascade point,
			//cut the arrau from the casecade point, average the removed data and unsift if to the next array (if it exists)

			if(store.store[idx].length >= (2* that.cascadePoints[idx])){
				var trimmedData = store.store[idx].splice(that.cascadePoints[idx],that.cascadePoints[idx])
				var averagedData = 0
				trimmedData.forEach(function(dataElement){
					averagedData += dataElement
				})
				averagedData = (Math.floor((averagedData / trimmedData.length) * Math.pow(10, that.accuracyDP))) / Math.pow(10, that.accuracyDP)
				if(store.store[idx+1]){
					store.store[idx+1].unshift(averagedData)
				} else {
					store.store[idx+1] = [averagedData]
				}
				that.cascadeIterator(idx+1, store, callback)
			} else {
				callback(store)
			}
		} else {
			callback(store)
		}
	},
	getGraphData: function(store, callback){
		//return the data up to each of the cascades
		var that = this
		that.getGraphDataIterator(store, 0, 0, null, function(resultArray){
			callback(resultArray)
		})

	},
	getGraphDataIterator: function(store, idx, cascadeIdx, resultObject, callback){
		var that = this
		resultObject = resultObject ? resultObject : {labels: [], data: []}
		if(that.cascadePoints){
			if(that.cascadePoints[cascadeIdx]){
				if(idx < that.cascadePoints[cascadeIdx]){
					if(store.store){
						if(store.store[cascadeIdx]){
							if(store.store[cascadeIdx][idx]){
								resultObject.data.push(store.store[cascadeIdx][idx])
								resultObject.labels.push(that.cascadeLabels[cascadeIdx][idx])
								that.getGraphDataIterator(store, idx+1, cascadeIdx	, resultObject, callback)	
							} else {
								that.getGraphDataIterator(store, 0, cascadeIdx+1, resultObject, callback)	
							}
						} else {
							callback(resultObject)
						}
					} else {
						callback()
					}
				} else {
					that.getGraphDataIterator(store, 0, cascadeIdx+1, resultObject, callback)
				}
			} else {
				callback(resultObject)
			}
		} else {
			callback()
		}
	}
}

module.exports = averagingAnalyticModule;

var store = null;
var runTest = false;

process.argv.forEach(function (val, index, array) {
	if(val == 'runTest'){runTest = true}
});

//simple built in test fired with runTest command line switch
if(runTest){
	setInterval(function(){
		var newValue = Math.floor(Math.random() * 1000)
		averagingAnalyticModule.pushDataToStore(newValue, store, function(returnedStore){
			store = returnedStore
			averagingAnalyticModule.getGraphData(store, function(outputResults){
				console.log(JSON.stringify(store))
				console.log(outputResults.labels.join('\t'))	
				console.log(outputResults.data.join('\t'))
				console.log('\r')	
			})
		})
	},2000)
}