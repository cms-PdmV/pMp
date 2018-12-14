/*** Life-Time Representation of Requests directive:***/
.directive('linearLifetime', ['$compile', '$http', function($compile, $http) {
    return {
        restrict: 'AE',
        scope: {
            chartData: '=',
            humanReadableNumbers: '=',
            taskChain: '=',
            zoomY: '='
        },
            link: function(scope, element, compile, http) {
            // graph configuration
            config = {
                customWidth: 1160,
                customHeight: 500,
                margin: {
                    top: 40,
                    right: 50,
                    bottom: 50,
                    left: 50
                }
            };

            // initiate scope related variables
            scope.labelData = [];
            scope.dataCopy = [];

            // General attributes
            var width = config.customWidth - config.margin.left - config.margin.right;
            var height = config.customHeight - config.margin.top - config.margin.bottom;
            var l1, l2, l3, svg, containerBox, hoverLineGroup, rectLifetime;
            // add main svg
            svg = d3.select(element[0])
                    .append('svg:svg')
                    .attr("viewBox", "0 -20 " + config.customWidth + " " + config.customHeight)
                    .attr("xmlns", "http://www.w3.org/2000/svg")
                    .append("svg:g")
                    .attr("transform", "translate(" + config.margin.left + "," + config.margin.top + ")")
                    .attr('style', 'fill: none');

            function formatBigNumbers(number) {
                var result = ''
                if (number >= 1e9) {
                    result = (Math.round(number / 10000000.0) / 100.0).toFixed(2) + "G"
                } else if (number >= 1e6) {
                    result = (Math.round(number / 10000.0) / 100.0).toFixed(2) + "M"
                } else if (number >= 1e3) {
                    result = (Math.round(number / 10.0) / 100.0).toFixed(2) + "k"
                } else {
                    result = number.toString()
                }
                return result.replace('.00', '')
                             .replace('.10', '.1')
                             .replace('.20', '.2')
                             .replace('.30', '.3')
                             .replace('.40', '.4')
                             .replace('.50', '.5')
                             .replace('.60', '.6')
                             .replace('.70', '.7')
                             .replace('.80', '.8')
                             .replace('.90', '.9')
            }

            // axes
            // Create a linear scale for time
            var x = d3.scaleTime().range([0, width]);
            // TODO add subdivision
            var xAxis = d3.axisBottom(x).ticks(10);
            var gx = svg.append("svg:g")
                .attr("class", "x axis minorx")
                .attr("font-size", "12")
                .attr('fill', '#666')
                .attr("transform", "translate(0," + (height + 10) + ")")
                .call(xAxis);
            var y = d3.scaleLinear().range([height, 0]);
            var yAxis = d3.axisLeft(y).ticks(5).tickFormat(formatBigNumbers);
            var gy = svg.append("svg:g")
                .attr("class", "y axis minory")
                .attr("font-size", "12")
                .attr('fill', '#666')
                .call(yAxis)
            gy.append("text")
              .attr("id", "ytitle")
              .attr("dy", "-20px")
              .attr("dx", '-5px')
              .style("text-anchor", "end")
              .attr("font-size", "13")
              .text('events');

            var zoom = d3.zoom().on("zoom", onZoom);
            function onZoom() {
                var dx = d3.event.transform.x
                var dy = d3.event.transform.y
                var dk = d3.event.transform.k
                svg.select("g.hover-line").remove();
                hoverLineGroup = undefined;

                if (scope.zoomY) {
                    gx.call(xAxis.scale(d3.event.transform.rescaleX(x)));
                    gy.call(yAxis.scale(d3.event.transform.rescaleY(y)));
                    var transformString = "translate(" + dx + "," + dy + ") scale(" + dk + "," + dk + ")";
                    svg.select("path.expected-graph-data").attr("transform", transformString)
                    svg.select("path.done-graph-data").attr("transform", transformString)
                    svg.select("path.produced-graph-data").attr("transform", transformString)
                } else {
                    gx.call(xAxis.scale(d3.event.transform.rescaleX(x)));
                    var transformString = "translate(" + dx + ",0) scale(" + dk + ",1)";
                    svg.select("path.expected-graph-data").attr("transform", transformString)
                    svg.select("path.done-graph-data").attr("transform", transformString)
                    svg.select("path.produced-graph-data").attr("transform", transformString)
                }
            }


            var expectedPlot = d3.area()
                                 .curve(d3.curveStepAfter)
                                 .x(function(d) { return x(d.t); })
                                 .y0(function(d) { return y(d.x < 0 ? 0 : d.e); })
                                 .y1(function(d) { return y(d.x); });

            var donePlot = d3.area()
                                 .curve(d3.curveStepAfter)
                                 .x(function(d) { return x(d.t); })
                                 .y0(function(d) { return y(0); })
                                 .y1(function(d) { return y(d.d); });

            var producedPlot = d3.area()
                                 .curve(d3.curveStepAfter)
                                 .x(function(d) { return x(d.t); })
                                 .y0(function(d) { return y(d.d); })
                                 .y1(function(d) { return y(d.e); });

            // When new data to load
            var onLoad = function(data) {
                // Update ranges of axis according to new data
                x.domain([d3.min(data, function(d) { return d.t; }),
                          d3.max(data, function(d) { return d.t; })]).range([0, width]);
                // Max for y should be max of three numbers in case there are more events produced than expected
                y.domain([0,
                          d3.max(data, function(d) { return Math.max(d.e, d.d, d.x); }) * 1.05]).range([height, 0]);
                xAxis.scale(x);
                yAxis.scale(y);
                svg.selectAll("g .x.axis").call(xAxis);
                svg.selectAll("g .y.axis").call(yAxis);
                svg.select("path.expected-graph-data").remove()
                svg.select("path.done-graph-data").remove()
                svg.select("path.produced-graph-data").remove()
                svg.select("g.hover-line").remove();
                svg.select("#lifetime").remove();
                svg.append("path")
                   .data([data])
                   .attr("class", "expected-graph-data")
                   .attr("d", expectedPlot);
                svg.append("path")
                   .data([data]).transition()
                   .attr("class", "done-graph-data")
                   .attr("d", donePlot);
                svg.append("path")
                   .data([data]).transition()
                   .attr("class", "produced-graph-data")
                   .attr("d", producedPlot);

                svg.append("rect")
                    .attr('id', 'lifetime')
                    .attr("class", "pane")
                    .attr("x", 0)
                    .style('cursor', 'move')
                    .style('fill', 'none')
                    .style('pointer-events', 'all')
                    .attr("width", width)
                    .attr("height", height)
                    .call(zoom);

                constructDataLabel()
            };

            var prepareData = function(data) {
                scope.dataCopy = angular.copy(data);
                onLoad(scope.dataCopy);
            };

            scope.$watch('chartData', function(data) {
                if (data !== undefined && data.length) {
                    prepareData(data);
                }
            });

            var constructDataLabel = function() {
                hoverLineGroup = undefined;
                containerBox = document.querySelector('#lifetime');

                var handleMouseOverGraph = function(event) {
                    var hoverLineXOffset = $(containerBox).offset().left;
                    var hoverLineYOffset = config.margin.top + $(containerBox).offset().top;
                    var mouseX = event.pageX - hoverLineXOffset;
                    var mouseY = event.pageY - hoverLineYOffset;
                    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
                        displayValueLabelsForPositionX(mouseX);
                    }
                };

                var updateIndicatorPosition = function(data) {
                    if (!hoverLineGroup) {
                        hoverLineGroup = svg.insert("svg:g", "#lifetime").attr("class", "hover-line");
                        hoverLine = hoverLineGroup.append("svg:line")
                                                  .attr("y1", 0)
                                                  .attr("y2", height + 10)
                                                  .style('stroke-width', '1px')
                                                  .style('stroke', '#777777');
                    }
                    hoverLine.attr("x1", data).attr("x2", data);
                };

                var updateDataLabel = function(data) {
                    data[0] = data[0].toDateString() + ' ' + data[0].toLocaleTimeString();

                    var html = ''
                    html += '<div style="color: #90a4ae;">Time: ' + data[0] + "</div>"
                    html += '<div style="color: #263238;">Expected events: ' + (scope.humanReadableNumbers ? formatBigNumbers(data[1]) : data[1]) + "</div>"
                    html += '<div style="color: #ff6f00;">Events in DAS: ' + (scope.humanReadableNumbers ? formatBigNumbers(data[2]) : data[2]) + "</div>"
                    html += '<div style="color: #01579b;">Done events in DAS: ' + (scope.humanReadableNumbers ? formatBigNumbers(data[3]) : data[3]) + "</div>"
                    $("#historical-drilldown").html(html);
                };

                var displayValueLabelsForPositionX = function(xPosition) {
                    var tmp, data = [];
                    var s = xAxis.scale().domain();
                    var min = s[0].getTime();
                    var max = s[1].getTime();
                    var local = scope.dataCopy;
                    var measure = $('#measure').width();
                    var w = measure * width / config.customWidth;
                    tmp = min + (xPosition / w * (max - min));
                    var closestIndex = 0;
                    var smallestDiff = 1e12;
                    for (var i = 0; i < local.length; i++) {
                        var newDiff = Math.abs(tmp - local[i].t)
                        if (newDiff < smallestDiff) {
                            smallestDiff = newDiff;
                            closestIndex = i;
                        }
                    }
                    data[0] = local[closestIndex].t;
                    data[1] = local[closestIndex].x;
                    data[2] = local[closestIndex].e;
                    data[3] = local[closestIndex].d;
                    data[0] = new Date(data[0]);
                    tmp = (data[0] - min) / ((max - min) / width);
                    updateIndicatorPosition(tmp);
                    updateDataLabel(data);
                    
                };

                // Watch for mouse events
                $(containerBox).mousemove(function(event) {
                    handleMouseOverGraph(event);
                });
                // updateDataLabel([false, '', '', '']);
                displayValueLabelsForPositionX(1100);
            };
        }
    };
}])
