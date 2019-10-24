var moduleName = 'webserver'
const fs = require('fs');
const settings = require('./settings.json')
const path = require('path');
const appDir = path.dirname(require.main.filename);
const express = require('express');
const app = express();
var server = require('http').Server(app);
const bodyParser = require('body-parser')
const util = require('util');
const Logger = require('./logger.js')
const mongoUtils = require('./mongoUtils.js')
const averagingAnalyticModule = require('./averagingAnalyticModule.js')
const port = 3030
const broadcastIterationDelay = 250
var io = require('socket.io')(server);
const connections = [];
//udpUtils.init()

//socket handling for client diagnostics.
io.sockets.on('connection',(socket) => {
   connections.push(socket);
   console.log(' %s sockets is connected', connections.length);

   socket.on('disconnect', () => {
      connections.splice(connections.indexOf(socket), 1);
   });

   socket.on('sending message', (message) => {
      console.log('Message is received :', message);

      io.sockets.emit('new message', {message: message});
   });
});

app.use(bodyParser.json() );
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
	extended: true
})); 

app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies``

app.use(express.static('public'))

var wsFunctions = {
	logger: null,
	allLessonNamesArray: null,
	init: function(callback){
		var that = this
		that.logger = new Logger(settings.logOptions)
		mongoUtils.init(that.logger, function(){
			server.listen(settings.webserver.port);
			console.log('Listening on port ' + settings.webserver.port + '...')
			that.processIterator(0)
			callback()
		})
	},
	allLessons: function(callback){
		var that = this
		mongoUtils.getLessons(function(lessonData){
			that.logger.log(moduleName, 4, 'lesson data:' + JSON.stringify(lessonData))
			callback(lessonData)
		})
	},
	allLessonNames: function(callback){
		var that = this
		mongoUtils.getAllLessonNames(function(allLessonNames){
			that.logger.log(moduleName, 4, 'all lesson names:' + allLessonNames.join(','))
			callback(allLessonNames)
		})
	},
	countSpheronsGroupedByLesson: function(callback){
		var that = this
		mongoUtils.countSpheronsGroupedByLesson(function(spheronData){
			that.logger.log(moduleName, 4, 'spheron counts:' + JSON.stringify(spheronData))
			callback(spheronData)
		})
	},
	getFitnessGraphByLessonId: function(lessonId, callback){
		var that = this
		mongoUtils.getLessonFitnessByLessonId(lessonId, function(store){
			if(store){
				console.log("store is: " +JSON.stringify(store))
				that.logger.log(moduleName, 4, 'analytical store data for lesson: ' + lessonId + ' : '+ JSON.stringify(store))
				//now pipe the raw data through the formatting function...
				averagingAnalyticModule.getGraphData(store, function(formattedGraphData){
					callback(formattedGraphData)
				})
			} else {
				callback()
			}
		})
	},
	getGraphDataByLessonId: function(graphType, lessonId, callback){
		var that = this
		mongoUtils.getLessonFitnessByLessonId(lessonId, function(store){
			if(store){
				console.log("store is: " +JSON.stringify(store))
				that.logger.log(moduleName, 4, 'analytical store data for lesson: ' + lessonId + ' : '+ JSON.stringify(store))
				//now pipe the raw data through the formatting function...
				averagingAnalyticModule.getGraphData(store, function(formattedGraphData){
					callback(formattedGraphData)
				})
			} else {
				callback()
			}
		})
	},
	processIterator: function(phaseIdx){
		var that = this
		/*
		* loop through broadcasting each bit of data rather than relying on get commands...
		*/
		console.log('in process iterator')
		switch(phaseIdx){
			case 0:
			//broadcast all lessons
			that.allLessonNames(function(allLessonNamesList){
				that.allLessonNamesArray = allLessonNamesList
				that.sendMessageAndIteratePhase({'type': 'lessonList', 'list' : allLessonNamesList}, phaseIdx)
			})
			break;
			case 1:
			//broadcast spheron counts
			that.countSpheronsGroupedByLesson(function(lessonSpheronStats){
				that.sendMessageAndIteratePhase({'type' : 'lessonSpheronStats', 'stats': lessonSpheronStats}, phaseIdx)
			})
			break;
			case 2:
			//broadcast lesson analytics for each model
			that.iterateBroadcastLessonAnalytics(null, 0,0, function(lessonSpheronStats){
				that.processIterator(phaseIdx+1)
			})
			break;

		default:
			that.processIterator(0)
			break;
		}
	},
	iterateBroadcastLessonAnalytics(lessonAnalyticData, lessonIdx, reportIdx, callback){
		console.log('in iterateBroadcastLessonAnalytics')
		var that = this
		if(!lessonAnalyticData){
			console.log('this lesson is: ' + that.allLessonNamesArray[lessonIdx])
			if(that.allLessonNamesArray[lessonIdx] !== undefined){
				mongoUtils.getLessonAnalyticDataByLessonId(that.allLessonNamesArray[lessonIdx], function(store){
					if(store == undefined || store === undefined){
						console.log('analytic data was undefined. Restarting after a pause...')
						setTimeout(function(){
							that.processIterator(0)
						},broadcastIterationDelay)
					} else {
						console.log('got lesson analytic data: ' + JSON.stringify(store))
						that.iterateBroadcastLessonAnalytics(store, lessonIdx, reportIdx, callback)	
					}
				})
			} else {
				callback()
			}
			
		} else {
			if(that.allLessonNamesArray[lessonIdx]){
				var lessonId = that.allLessonNamesArray[lessonIdx]
				if(reportIdx == 0){
					if(lessonAnalyticData.absError != null){
						averagingAnalyticModule.getGraphData(lessonAnalyticData.absError, function(absErrors){
							io.sockets.emit('message', {message: {'type' : 'graph', 'lessonId' : lessonId, 'graphDimension' : 'absErrors', 'graphData': absErrors}});
							setTimeout(function(){
								that.iterateBroadcastLessonAnalytics(lessonAnalyticData, lessonIdx, reportIdx+1, callback)
							},broadcastIterationDelay)	
						})	
					} else {
						that.iterateBroadcastLessonAnalytics(lessonAnalyticData, lessonIdx, reportIdx+1, callback)
					}
					
				} else if(reportIdx == 1){
					if(lessonAnalyticData.highestError != null){
						averagingAnalyticModule.getGraphData(lessonAnalyticData.highestError, function(highestErrors){
							io.sockets.emit('message', {message: {'type' : 'graph', 'lessonId' : lessonId, 'graphDimension' : 'highestErrors', 'graphData': highestErrors}});
							setTimeout(function(){
								that.iterateBroadcastLessonAnalytics(lessonAnalyticData, lessonIdx, reportIdx+1, callback)
							},broadcastIterationDelay)	
						})
					} else {
						that.iterateBroadcastLessonAnalytics(lessonAnalyticData, lessonIdx, reportIdx+1, callback)
					}
				} else if(reportIdx == 2){
					if(lessonAnalyticData.lowestError != null){
						averagingAnalyticModule.getGraphData(lessonAnalyticData.lowestError, function(lowestErrors){
							io.sockets.emit('message', {message: {'type' : 'graph', 'lessonId' : lessonId, 'graphDimension' : 'lowestErrors', 'graphData': lowestErrors}});
							setTimeout(function(){
								that.iterateBroadcastLessonAnalytics(lessonAnalyticData, lessonIdx, reportIdx+1, callback)
							},broadcastIterationDelay)	
						})
					} else {
						that.iterateBroadcastLessonAnalytics(lessonAnalyticData, lessonIdx, reportIdx+1, callback)
					}
				} else {
					that.iterateBroadcastLessonAnalytics(null, lessonIdx+1, 0, callback)
				}
			} else {
				callback()
			}	
		}
	},
	sendMessageAndIteratePhase:function(message, phaseIdx){
		var that = this
		console.log('emitting...')
		io.sockets.emit('message', {message: message});
		setTimeout(function(){
			that.processIterator(phaseIdx+1)
		},broadcastIterationDelay)	
	},
	isJson: function(str) {
	    try {
	        JSON.parse(str);
	    } catch (e) {
	        return false;
	    }
	    return true;
	},
	isLesson: function(str){
		if(str.type && str.lessonId && str.network && str.lesson){
			if(str.type == 'lesson'){
				return true
			} else {
				return false
			}
		} else {
			return false
		}
	}
}

app.get('/getFitnessGraphByLessonId', function(req, res) {
	var thisLessonId = req.query.lessonId.toString()
	console.log('getting data for lessonId: ' + thisLessonId)
	wsFunctions.getFitnessGraphByLessonId(thisLessonId, function(graphData){	
		res.send(JSON.stringify(graphData))
	})
});

app.get('/deleteLesson', function(req, res) {
	var thisLessonId = req.query.lessonId.toString()
	console.log('running delete lesson: ' + thisLessonId)
	
	//TODO: Delete the lesson...
	//Note: We should also broadcast delete via socketio so the UX's know to take the element out of current displays
	//delete spheronsByLessonId
	//delete lessonByLessonId
	mongoUtils.deleteSpheronsByLessonId(thisLessonId, function(){
		mongoUtils.deleteLessonByLessonId(thisLessonId, function(){
			//now broadcast over socket so UX can update..
			io.sockets.emit('message', {message: {'type' : 'lessonDeleted', 'lessonId' : thisLessonId}});
			res.end('all done')
		})	
	})
});

app.post('/uploadLesson', function(req, res) {
	console.log('running upload lesson..')
	//is this payload JSON?
	console.log(JSON.stringify(req.body))
	if(req.body){
		//if(wsFunctions.isJson(req.data)){
			if(wsFunctions.isLesson(req.body) == true){
				mongoUtils.importProblem(req.body, function(){
					//TO Be Decided: We may also need to move a javascript file into the activationModules directory if one is uploaded...
					//TODO: set the lesson as pending and a flag of needsInit = this should gthen signal the lessonManager to run the init function when it next cycles.
					res.end('{"success" : "Updated Successfully", "status" : 200}')	

				})
			} else {
				res.end('{"failed" : "data does not appear to be a lesson", "status" : 400}')
			}
		//} else {
		//	res.end('{"failed" : "data does not contain JSON", "status" : 400}')
		//}
	} else {
		res.end('{"failed" : "no data payload in body", "status" : 400}')
	}
});



wsFunctions.init(function(){
	console.log('all fired up...')
})
