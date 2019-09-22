var moduleName = 'webserver'
const fs = require('fs');
const settings = require('./settings.json')
const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const util = require('util');
const Logger = require('./logger.js')
const mongoUtils = require('./mongoUtils.js')
const averagingAnalyticModule = require('./averagingAnalyticModule.js')
const port = 3030

app.use(express.static('public'))

var wsFunctions = {
	logger: null,
	init: function(callback){
		var that = this
		that.logger = new Logger(settings.logOptions)
		mongoUtils.init(that.logger, function(){
			app.listen(settings.webserver.port);
			console.log('Listening on port ' + settings.webserver.port + '...')
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
	}
}

app.get('/allLessons', function(req, res) {
	wsFunctions.allLessons(function(allLessons){
		res.send(allLessons)
	})
});

app.get('/allLessonNames', function(req, res) {
	wsFunctions.allLessonNames(function(allLessonNames){
		res.send(allLessonNames)
	})
});

app.get('/countSpheronsGroupedByLesson', function(req, res) {
	wsFunctions.countSpheronsGroupedByLesson(function(spheronStats){
		res.send(spheronStats)
	})
});

app.get('/getFitnessGraphByLessonId', function(req, res) {
	var thisLessonId = req.query.lessonId.toString()
	console.log('getting data for lessonId: ' + thisLessonId)
	wsFunctions.getFitnessGraphByLessonId(thisLessonId, function(graphData){	
		res.send(JSON.stringify(graphData))
	})
});

wsFunctions.init(function(){
	console.log('all fired up...')
})
