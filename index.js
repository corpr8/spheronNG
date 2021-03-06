var fork = require('child_process').fork; 
var settings = require('./settings.json')
var fs = require('fs');
var findProcess = require('find-process')
var terminate = require('terminate');

var thisApp ={
	tddChild: null,
	logAnalyserChild: null,
	mainProgChild: null,
	processArguments: [],
	deleteLogfile: function(callback){
 		fs.unlink(settings.logOptions.logPath, function(){
 			callback()
 		})
	},
	runTdd: function(callback){
		var that = this
		that.tddChild = fork('./tdd.js', [], {
		  stdio: 'pipe'
		});
 
		that.tddChild.stderr.on('data', (data) => {
		  console.error(`child stderr:\n${data}`);
		});

		that.tddChild.on('exit', function (code, signal) {
			console.log('exited with code: ' + code + ' and signal: ' + signal)
		  if(code == 1){
		  	console.log('TDD Tests failed.');
		  	//process.exitCode = 1
		  	callback('failed')
		  } else {
		  	console.log('TDD Tests passed.'); 
		  	callback('passed')
		  }
		});

	},
	runLogAnalysis: function(callback){
		console.log('running log analysis') 
		var that = this
		that.logAnalyserChild = fork('./logAnalyser.js', [], {});

		that.logAnalyserChild.on('message', (data) => {
		  console.error(`child message:\n${data}`);
		}); 
 
		that.logAnalyserChild.on('exit', function (code, signal) {
			console.log('log analyser exited with code: ' + code + ' and signal: ' + signal)
		  if(code == 1){
		  	console.log('Log analyser failed.');
		  	//process.exitCode = 1
		  	callback('failed')
		  } else {
		  	console.log('Log analyser passed.'); 
		  	callback('passed')
		  }
		});
	},
	runMainProg: function(callback){
		var that = this
		if(that.processArguments.indexOf('NOTDD') == -1){
			that.mainProgChild = fork('./spheron_runner.js', [], {
			  stdio: 'pipe'
			});	
		} else {
			that.mainProgChild = fork('./spheron_runner.js', ['NOTDD'], {
			  stdio: 'pipe'
			});
		}
		

		that.mainProgChild.stderr.on('data', (data) => {
		  console.error(`child stderr:\n${data}`);
		});

		that.mainProgChild.on('exit', function (code, signal) {
		  if(code == 1){
		  	console.log('Main program exited with code 1.');
		  	callback()
		  } else {
		  	console.log('Main program exited with code 0.');
		  	callback()
		  }
		});
	},
	killOtherProcesses: function(callback){
		var that = this
		that.getRunningNodePids(function(pidList){
			for(var v=0;v<pidList.length;v++){
				//console.log('PID is: ' + pidList[v].pid + ' PPID is:' + pidList[v].ppid + ' our PID is: ' + process.pid)
				if(pidList[v].pid != process.pid){
					//console.log('killing ppid')
					terminate(pidList[v].pid)	
				}
			}
			callback()
		})
	},
	killMain: function(callback){
		var that = this
		try{
			that.mainProgChild.kill()
			that.mainProgChild = null
			callback()

		} catch(err){
			callback()
		}
	},
	killTdd:function(callback){
		var that = this  
		try{
			that.tddChild.kill()
			that.tddChild = null
			callback()

		} catch(err){
			callback()
		}	
	},
	safeRestart: function(callback){
		var that = this
		that.deleteLogfile(function(){
			that.killOtherProcesses(function(){
				if(that.processArguments.indexOf('NOTDD') == -1){
					that.runTdd(function(tddTestResult){
						console.log('waiting for .5 second so log buffer clears :-/')
						setTimeout(function(){ 
							that.runLogAnalysis(function(logAnalysisResult){
							
								//console.log('TDD test result: ' + testResult)
								if(tddTestResult == 'passed' && logAnalysisResult == 'passed'){
									console.log('running code in production mode') 
									that.runMainProg(function(){
										callback('finished running main program...')
								  	})
								} else {
									console.log('killing any running processes (TDD or Main Program).')

									that.killOtherProcesses(function(){}) 
								}
							})	
						}, 1000)   
					
					})
				} else {
					console.log('running code in production mode') 
					that.runMainProg(function(){
						callback('finished running main program...')
					})
				}
			})	
		})
	},
	watcherArray: [],
	watchHandler: function(eventType, fileName){
		var that = this
		var excluedFile = false
		fileName = fileName.toString()
		for(var v=0;v< settings.dev.excludedTypes.length;v++){
			if(fileName.indexOf(settings.dev.excludedTypes[v]) != -1){
				excluedFile = true
			}
		} 
		if(excluedFile){
			//ignore this...
		} else {
			console.log('______________________________________________________')
			console.log(fileName + ' changed. running tests and restarting app.')
			thisApp.safeRestart(function(exitCode){
				console.log(exitCode)
			})
		}
	},
	getRunningNodePids: function(callback){
		findProcess('name', 'node', true).then(function (list) {
		    //console.log(JSON.stringify(list))
		    callback(list)
		});
	},
	init: function(){
		console.log('______________________________________________________')
		console.log('___________________Running Init_______________________')
		var that = this


		process.argv.forEach(function (val, index, array) {
			that.processArguments.push(val)
		});

		//setupFileWatcher and call safeRestart on each change...
		if(that.processArguments.indexOf('NOTDD') == -1){
			process.on('SIGINT', function() {
				that.killOtherProcesses(function(){
					process.exitCode = 0
					process.exit()
				})
			});


			for(var v=0;v< settings.dev.fileWatch.length;v++){
				var thisWatcher = fs.watch(settings.dev.fileWatch[v], that.watchHandler)
				that.watcherArray.push(thisWatcher)
			}	
		}
		
		that.safeRestart(function(exitCode){
			console.log('calling back from safeRestart with: ' + exitCode)
		})
	}
}

thisApp.init()
  
