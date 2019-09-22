var thisApp = {
	theseCharts: [],
	getDataPaintGraph(lessonId, callback){
		var that = this
		that._getGraphData(lessonId, function(graphData){
			console.log('graph data is: ' + graphData)
			graphData = JSON.parse(graphData)
			that._addGraphPanel(lessonId, function(){
				that._createGraph(lessonId, graphData, function(){
					callback()
				})

			})
		})
	},
	_addGraphPanel(lessonId, callback){
		var that = this
		if($('#' + lessonId).length == 0){	
			var newPanel =""
			newPanel +='<div class="row">'
			newPanel +='<div class="col-xl-12 col-md-12">'
			newPanel +='<!-- Sales Graph -->'
			newPanel +='<div class="card card-default" data-scroll-height="675">'
			newPanel +='<div class="card-header">'
			newPanel +='<h2>' + lessonId + '</h2>'
			newPanel +='</div>'
			newPanel +='<div class="card-body">'
			newPanel +='<canvas id="' + lessonId + '" class="chartjs"></canvas>'
			newPanel +='</div>'
			newPanel +='<div class="card-footer d-flex flex-wrap bg-white p-0">'
			newPanel +='</div>'
			newPanel +='</div>'
			newPanel +='</div>'
			newPanel +='</div>'
			var $panel = $(newPanel)
			$('.content').append($panel)
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
	_createGraph(lessonId, graphData, callback){
	  /*======== 3. LINE CHART ========*/
	  var that = this
	  if(that.theseCharts[lessonId]){
	  	for(var v=0;v<graphData.data.length;v++){
	  			that.theseCharts[lessonId].data.labels[v] = graphData.labels[v]
	  		if(that.theseCharts[lessonId].data.datasets[0].data[v]){
	  			that.theseCharts[lessonId].data.datasets[0].data[v] = graphData.data[v]
	  		} else {
				that.theseCharts[lessonId].data.datasets[0].data.push()	  			
	  		}
	  	}
	  } else {
		  var ctx = document.getElementById(lessonId);
		  if (ctx !== null) {
		    that.theseCharts[lessonId] = new Chart(ctx, {
		      // The type of chart we want to create
		      type: "line",

		      // The data for our dataset
		      data: {
		        labels: graphData.labels,
		        datasets: [
		          {
		            label: "",
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
		          display: false
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
		              return "$" + data["datasets"][0]["data"][tooltipItem["index"]];
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
	_getAllLessons(callback){
		var that = this
		$.get("allLessonNames", function(allLessons){
			console.log('got lessons:' + allLessons.join(','))
			callback(allLessons)
		})
	},
	_iterateLessons(allLessons, idx, callback){
		var that = this
		if(allLessons[idx]){
			if(allLessons[idx] != null){
				console.log('painting: ' + allLessons[idx])
				thisApp.getDataPaintGraph(allLessons[idx], function(){
					that._iterateLessons(allLessons, idx+1, callback)
				})
			} else {
				that._iterateLessons(allLessons, idx+1, callback)
			}
		} else{
			callback()
		}
	},
	initUpdateUX(callback){
		var that = this
		console.log('updating ux')
		that._getAllLessons(function(allLessons){
			that._iterateLessons(allLessons, 0, function(){
				callback()
			})
		})	
	}
}

$( document ).ready(function(){
	toastr.success("This is my fist toast", "isn't that cool");
	setInterval(function(){thisApp.initUpdateUX(function(){})},2500)
})
