/*
* All combinations from each array exclusively (i.e. 1 from each array is excluded at any given time)
*
* Feed it an array of arrys of exclusive variants:
*
* [
*	[12,23,34],
*	[21,32,43],
*	[212,323,434]
* ]
*
* It will return an array of arrays which define what to exclude from each test.
*
* i.e. in the above, the first exclusion would be: [12,23],[21,32],[212,323] as we only want to test 34, 21 and 212 at the same time
* We can then use this in the spheron main code to update the exclusion maps for each spheron activation....
* node ./tests/multivariator_test.js
*
*/
var moduleName = 'multivariator'
var path = require('path');
var appDir = path.dirname(require.main.filename);
var settings = require(appDir +'/settings.json')

var multivariator = {  
	logger: null,
	finalOutput: [],
	init: function(logger, callback){
		var that = this
		that.logger = logger;
		that.logger.log(moduleName, 2,'init') 
		callback()
	},
	multivariate: function(array, callback){
		var that = this
	    var v = permute(array)

	    //v now contains an exclusion map of each of the arrays
	    callback(v)
	}

}

//https://stackoverflow.com/questions/21952437/combinations-of-elements-of-multiple-arrays

var permute = function(input)
{
  var out = [];

  (function permute_r(input, current) {
    if (input.length === 0) {
      out.push(current);
      return;
    }

    var next = input.slice(1);

    for (var i = 0, n = input[0].length; i != n; ++i) {
      permute_r(next, current.concat([input[0][i]]));
    }
  }(input, []));

  return out;
}

module.exports = multivariator
