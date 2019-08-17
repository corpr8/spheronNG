"use strict";
const fs = require('fs');

var logger = function(logOptions){
	var that = this
	that.logOptions = logOptions
	that.logQueue = []
	that.isWriting = false
	that.wStream = fs.createWriteStream(logOptions.logPath, { flags: 'a', encoding: 'ascii' });
	that.wStream.on('error', function(e){
		throw('logger error: ' + e)
	})
}

logger.prototype.log = function(moduleName, logOption, logMsg){
	var that = this
	logMsg = (logMsg) ? logMsg.toString() : ''
	if((typeof(logOption) == 'number' && logOption <= that.logOptions.logLevel) || (logOption == 'extOutput' && that.logOptions.logExtOutputEvents == true)){
		var d = new Date()
		var datetext = (d.toTimeString()).split(' ')[0]
		var logMessage = datetext + ' : ' + moduleName + ' : ' + logMsg + '\n'
		that.logQueue.push(logMessage)
		if(that.isWriting == false){
			that.isWriting = true
			that.writeToLogFile(function(){

			})
		}
	}
}
 
logger.prototype.writeToLogFile = function(callback){
	var that = this
	if(that.logQueue.length >= 1){
		var thisMessage = that.logQueue.shift()
		that.wStream.write(thisMessage)
		that.writeToLogFile(callback)
	} else {
		that.isWriting = false
		callback()
	}	
}

logger.prototype.exit = function(callback){
	var that = this
	that.wStream.close()
	callback()
}

module.exports = logger;
