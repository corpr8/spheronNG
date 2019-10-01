var thisApp = {
	theseCharts: [],
	getDataPaintGraph(lessonId, callback){
		var that = this
		that._getGraphData(lessonId, function(graphData){
			console.log('graph data is: ' + graphData)
			graphData = JSON.parse(graphData)
			that._addLessonPanel(lessonId, function(){
				that._createGraph(lessonId, graphData, function(){
					callback()
				})

			})
		})
	},
	_addLessonPanel(lessonId, callback){
		var that = this
		if($('#' + lessonId).length == 0){	
			var newPanel =""
			newPanel +='<div class="row">'
			newPanel +='<div class="col-xl-12 col-md-12">'
			newPanel +='<!-- lesson panel -->'
			newPanel +='<div id="' + lessonId + '" class="card card-default" data-scroll-height="675">'
			newPanel +='<div class="card-header">'
			newPanel +='<h2>' + lessonId + '</h2>'
			newPanel +='</div>'
			newPanel +='<div class="card-footer d-flex flex-wrap bg-white p-0">'
			newPanel +='</div>'
			newPanel +='</div>'
			newPanel +='</div>'
			newPanel +='</div>'
			var $panel = $(newPanel)
			$('.content').prepend($panel)
			callback()	
		} else {
			console.log('panel already in UX')
			callback()
		}
		
	},
	_getGraphData(lessonId, callback){
		var that = this
		$.get("getFitnessGraphByLessonId", {lessonId: lessonId}, function(graphData){
			callback(graphData)
		})
	},
	_createUpdateGraph(lessonId, chartType, graphData, callback){
		console.log('inserting graph')
	  /*======== 3. LINE CHART ========*/
	  var that = this
	  if(!that.theseCharts[lessonId]){
	  	that.theseCharts[lessonId] = {}
	  }

	  if(that.theseCharts[lessonId][chartType]){
	  	for(var v=0;v<graphData.data.length;v++){
	  			that.theseCharts[lessonId][chartType].data.labels[v] = graphData.labels[v]
	  		if(that.theseCharts[lessonId][chartType].data.datasets[0].data[v]){
	  			that.theseCharts[lessonId][chartType].data.datasets[0].data[v] = graphData.data[v]
	  		} else {
				that.theseCharts[lessonId][chartType].data.datasets[0].data.push()	  			
	  		}
	  	}
	  } else {
	  	  console.log('graph object didnt exist. adding it.')
	  	  if($('#' + lessonId + chartType).length == 0){
	  	  	console.log('ux element didnt exist. Inserting it')
	  	  	//add the holder ux element.
	  	  	$('#' + lessonId).append('<div id=' + lessonId + chartType + ' class="card-body"><canvas id="' + lessonId + chartType + '-grph" class="chartjs"></canvas></div')
	  	  }
		  var ctx = document.getElementById(lessonId + chartType +'-grph');
		  if (ctx !== null) {
		    that.theseCharts[lessonId][chartType] = new Chart(ctx, {
		      // The type of chart we want to create
		      type: "line",

		      // The data for our dataset
		      data: {
		        labels: graphData.labels,
		        datasets: [
		          {
		            label: chartType,
		            backgroundColor: "transparent",
		            borderColor: "rgb(82, 136, 255)",
		            data: graphData.data,
		            lineTension: 0.3,
		            pointRadius: 5,
		            pointBackgroundColor: "rgba(255,255,255,1)",
		            pointHoverBackgroundColor: "rgba(255,255,255,1)",
		            pointBorderWidth: 2,
		            pointHoverRadius: 8,
		            pointHoverBorderWidth: 1
		          }
		        ]
		      },

		      // Configuration options go here
		      options: {
		        responsive: true,
		        maintainAspectRatio: false,
		        legend: {
		          display: true
		        },
		        layout: {
		          padding: {
		            right: 10
		          }
		        },
		        scales: {
		          xAxes: [
		            {
		              gridLines: {
		                display: false
		              }
		            }
		          ],
		          yAxes: [
		            {
		              gridLines: {
		                display: true,
		                color: "#eee",
		                zeroLineColor: "#eee",
		              },
		              ticks: {
		                callback: function (value) {
		                  var ranges = [
		                    { divider: 1e6, suffix: "M" },
		                    { divider: 1e4, suffix: "k" }
		                  ];
		                  function formatNumber(n) {
		                    for (var i = 0; i < ranges.length; i++) {
		                      if (n >= ranges[i].divider) {
		                        return (
		                          (n / ranges[i].divider).toString() + ranges[i].suffix
		                        );
		                      }
		                    }
		                    return n;
		                  }
		                  return formatNumber(value);
		                }
		              }
		            }
		          ]
		        },
		        tooltips: {
		          callbacks: {
		            title: function (tooltipItem, data) {
		              return data["labels"][tooltipItem[0]["index"]];
		            },
		            label: function (tooltipItem, data) {
		              return data["datasets"][0]["data"][tooltipItem["index"]];
		            }
		          },
		          responsive: true,
		          intersect: false,
		          enabled: true,
		          titleFontColor: "#888",
		          bodyFontColor: "#555",
		          titleFontSize: 12,
		          bodyFontSize: 18,
		          backgroundColor: "rgba(256,256,256,0.95)",
		          xPadding: 20,
		          yPadding: 10,
		          displayColors: false,
		          borderColor: "rgba(220, 220, 220, 0.9)",
		          borderWidth: 2,
		          caretSize: 10,
		          caretPadding: 15
		        }
		      }
		    });
		  }
	  }
	  callback()
	},
	appendToDiagnostics(thisMessage){
		var thisItem = document.createElement("div");
		thisItem.className = "well"
		thisItem.appendChild( document.createTextNode(thisMessage) )
		$('#diagnosticArea').prepend(thisItem)
	},
	addLessonsToUxIterator(idx, lessonList){
		var that = this
		if(lessonList[idx]){
			that._addLessonPanel(lessonList[idx], function(){
				that.addLessonsToUxIterator(idx+1, lessonList)
			})
		}
	},
	handleSocketMessage(message){
		var that = this
		msgCount += 1
		if(msgCount > 11){ $('#diagnosticArea').children().last().remove() }
		thisApp.appendToDiagnostics(JSON.stringify(message))
		if(message.type == 'lessonList'){
			that.addLessonsToUxIterator(0,message.list)
		} else if(message.type == 'graph'){
			that._createUpdateGraph(message.lessonId, message.graphDimension, message.graphData, function(){})
		} else {
			console.log('use case not handled yet.')
		}
	}
}

var msgCount=0

$( document ).ready(function(){
	toastr.success("This is my fist toast", "isn't that cool");
	var socket = io.connect();

	socket.on('message', function(data){
		thisApp.handleSocketMessage(data.message)
    })

})

