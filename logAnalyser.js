var moduleName = 'logAnalyser'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')
var LineByLineReader = require('line-by-line')

/*
* Module to analyse the log
*/ 

var logAnalyser = {
	lr:  null,
	lineNumber: 0,
	runLogger: function(){
		var that = this
		that.lr = new LineByLineReader(settings.logOptions.logPath);

		that.lr.on('error', function (err) {
			// 'err' contains error object
			console.log('log analysis error:' + err)
			process.exit(1)
		}); 

		that.lr.on('line', function (line) {
			// 'line' contains the current line without the trailing newline character.
			that.lr.pause()
			logAnalyser.lineNumber += 1
			if(line.indexOf('fail') != -1){ 
				console.log('\'Fail\' found at log line number: ' + logAnalyser.lineNumber)
				process.exitCode = 1 
			} else if(line.indexOf('we passed all test(s)') != -1){ 
				console.log('Passed all tests!')
				process.exitCode = 0 
			} else {
				that.lr.resume()
			}
		});

		that.lr.on('end', function () {
			// All lines are read, file is closed now.
			console.log('Analysed: ' + logAnalyser.lineNumber + ' lines. Found no failures.')
			process.exitCode = 1
		});
	}
}

module.exports = logAnalyser;

logAnalyser.runLogger()