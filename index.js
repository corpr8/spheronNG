var fork = require('child_process').fork;
var settings = require('./settings.json')
var fs = require('fs');
var findProcess = require('find-process')
var terminate = require('terminate');

var thisApp ={
	tddChild: null,
	mainProgChild: null,
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
	runMainProg: function(callback){
		var that = this
		that.mainProgChild = fork('./spheron_runner.js', [], {
		  stdio: 'pipe'
		});

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
		/*
		that.killTdd(function(){
			that.killMain(function(){
				callback()
			})
		})
		*/
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
				that.runTdd(function(testResult){
					//console.log('TDD test result: ' + testResult)
					if(testResult == 'passed'){
						that.runMainProg(function(){
							callback('finished running main program...')
					  	})
					} else {
						console.log('killing any running processes (TDD or Main Program).')
						that.killOtherProcesses(function(){})
					}
				})
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
		var that = this
		//setupFileWatcher and call safeRestart on each change...

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

		that.safeRestart(function(exitCode){
			console.log('calling back from safeRestart with: ' + exitCode)
		})
	}
}

thisApp.init()
  
