/*** Life-Time Representation of Requests directive:***/
.directive('linearLifetime', ['$compile', '$http', function($compile, $http) {
    return {
        restrict: 'AE',
        scope: {
            data: '=',
            humanReadableNumbers: '=',
            zoomY: '=',
            bigNumberFormatter: '='
        },
            link: function(scope, element, compile, http) {
            // graph configuration
            config = {
                customWidth: 1160,
                customHeight: 510,
                margin: {
                    top: 40,
                    right: 10,
                    bottom: 55,
                    left: 80
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
                    .attr("id", "plot")
                    .attr("transform", "translate(" + config.margin.left + "," + config.margin.top + ")")
                    .attr('style', 'fill: none');

            svg.append("defs").append("SVG:clipPath")
               .attr("id", "clip")
               .append("SVG:rect")
               .attr("width", width )
               .attr("height", height )
               .attr("x", 0)
               .attr("y", 0);
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
            var yAxis = d3.axisLeft(y).ticks(5).tickFormat(scope.bigNumberFormatter);
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

                var transformString = undefined;
                gx.call(xAxis.scale(d3.event.transform.rescaleX(x)));
                if (scope.zoomY) {
                    gy.call(yAxis.scale(d3.event.transform.rescaleY(y)));
                    transformString = "translate(" + dx + "," + dy + ") scale(" + dk + "," + dk + ")";
                } else {
                    transformString = "translate(" + dx + ",0) scale(" + dk + ",1)";
                }
                svg.select("path.expected-graph-data").attr("transform", transformString)
                svg.select("path.done-graph-data").attr("transform", transformString)
                svg.select("path.produced-graph-data").attr("transform", transformString)
                svg.select("path.invalid-graph-data").attr("transform", transformString)
                svg.select(".x.axis")
                   .selectAll('text')
                   .style("font-size","14px");
                svg.select(".y.axis")
                   .selectAll('text')
                   .style("font-size","14px");
            }


            var expectedPlot = d3.area()
                                 .curve(d3.curveStepAfter)
                                 .x(function(d) { return x(d.time); })
                                 .y0(function(d) { return y(d.expected < 0 ? 0 : d.produced + d.done + d.invalid); })
                                 .y1(function(d) { return y(d.expected); });

            var donePlot = d3.area()
                                 .curve(d3.curveStepAfter)
                                 .x(function(d) { return x(d.time); })
                                 .y0(function(d) { return y(d.invalid); })
                                 .y1(function(d) { return y(d.invalid + d.done); });

            var invalidPlot = d3.area()
                                 .curve(d3.curveStepAfter)
                                 .x(function(d) { return x(d.time); })
                                 .y0(function(d) { return y(0); })
                                 .y1(function(d) { return y(d.invalid); });

            var producedPlot = d3.area()
                                 .curve(d3.curveStepAfter)
                                 .x(function(d) { return x(d.time); })
                                 .y0(function(d) { return y(d.done + d.invalid); })
                                 .y1(function(d) { return y(d.done + d.invalid + d.produced); });

            var prepareData = function(data) {
                scope.dataCopy = angular.copy(data);
                // Update ranges of axis according to new data
                x.domain([d3.min(data, function(d) { return d.time; }),
                          d3.max(data, function(d) { return d.time; })]).range([0, width]);
                // Max for y should be max of three numbers in case there are more events produced than expected
                y.domain([0,
                          d3.max(data, function(d) { return Math.max(d.produced, d.done, d.expected, d.invalid, 10); }) * 1.05]).range([height, 0]);
                xAxis.scale(x);
                yAxis.scale(y);
                svg.selectAll("g .x.axis").call(xAxis);
                svg.selectAll("g .y.axis").call(yAxis);
                svg.select(".x.axis")
                   .selectAll('text')
                   .style("font-size","14px");
                svg.select(".y.axis")
                   .selectAll('text')
                   .style("font-size","14px");
                svg.select("path.expected-graph-data").remove()
                svg.select("path.done-graph-data").remove()
                svg.select("path.produced-graph-data").remove()
                svg.select("path.invalid-graph-data").remove()
                svg.selectAll("clipping-class").remove()
                svg.select("g.hover-line").remove();
                svg.select("#lifetime").remove();
                svg.append("g")
                   .attr("clip-path", "url(#clip)")
                   .attr("class", "clipping-class")
                   .append("path")
                   .data([data])
                   .attr("class", "expected-graph-data")
                   .attr("d", expectedPlot)
                   .style("opacity", "0.4")
                   .style("vector-effect", "non-scaling-stroke")
                   .style("stroke-width", "1")
                   .style("stroke", "#263238")
                   .style("fill", "#263238");

                svg.append("g")
                   .attr("clip-path", "url(#clip)")
                   .attr("class", "clipping-class")
                   .append("path")
                   .data([data])
                   .attr("class", "done-graph-data")
                   .attr("d", donePlot)
                   .style("opacity", "0.4")
                   .style("vector-effect", "non-scaling-stroke")
                   .style("stroke-width", "1")
                   .style("stroke", "#01579b")
                   .style("fill", "#01579b");

                svg.append("g")
                   .attr("clip-path", "url(#clip)")
                   .attr("class", "clipping-class")
                   .append("path")
                   .data([data])
                   .attr("class", "produced-graph-data")
                   .attr("d", producedPlot)
                   .style("opacity", "0.4")
                   .style("vector-effect", "non-scaling-stroke")
                   .style("stroke-width", "1")
                   .style("stroke", "#ff6f00")
                   .style("fill", "#ff6f00");

                svg.append("g")
                   .attr("clip-path", "url(#clip)")
                   .attr("class", "clipping-class")
                   .append("path")
                   .data([data])
                   .attr("class", "invalid-graph-data")
                   .attr("d", invalidPlot)
                   .style("opacity", "0.4")
                   .style("vector-effect", "non-scaling-stroke")
                   .style("stroke-width", "1")
                   .style("stroke", "red")
                   .style("fill", "red");

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

            scope.$watch('data', function(data) {
                if (data !== undefined && data.length) {
                    prepareData(data);
                }
            });

            var constructDataLabel = function() {
                hoverLineGroup = undefined;
                containerBox = document.querySelector('#lifetime');

                var handleMouseOverGraph = function(event) {
                    var boundingRect = event.currentTarget.getBoundingClientRect()
                    var mouseX = event.clientX - boundingRect.left;
                    var mouseY = event.clientY - boundingRect.top;
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
                    data[0] = dateFormat(data[0], "ddd, mmm dS, yyyy, HH:MM");

                    var html = ''
                    var width = (data[4] === 0 ? 25 : 20);
                    html += '<div style="color: #90a4ae; width: ' + width + '%">Time: ' + data[0] + "</div>"
                    html += '<div style="color: #263238; width: ' + width + '%" title="' + data[1] + '">Expected events: ' + (scope.humanReadableNumbers && data[1] > 0 ? scope.bigNumberFormatter(data[1]) : data[1]) + "</div>"
                    html += '<div style="color: #ff6f00; width: ' + width + '%" title="' + data[2] + '">Events in DAS: ' + (scope.humanReadableNumbers && data[2] > 0 ? scope.bigNumberFormatter(data[2]) : data[2]) + "</div>"
                    html += '<div style="color: #01579b; width: ' + width + '%" title="' + data[3] + '">Done events in DAS: ' + (scope.humanReadableNumbers && data[3] > 0 ? scope.bigNumberFormatter(data[3]) : data[3]) + "</div>"
                    if (data[4] !== 0) {
                      html += '<div style="color: red; width: ' + width + '%" title="' + data[4] + '">Deleted/Invalid events: ' + (scope.humanReadableNumbers && data[4] > 0 ? scope.bigNumberFormatter(data[4]) : data[4]) + "</div>"
                    }
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
                        var newDiff = Math.abs(tmp - local[i].time)
                        if (newDiff < smallestDiff) {
                            smallestDiff = newDiff;
                            closestIndex = i;
                        }
                    }
                    data[0] = local[closestIndex].time;
                    data[1] = local[closestIndex].expected;
                    data[2] = local[closestIndex].produced + local[closestIndex].done + local[closestIndex].invalid;
                    data[3] = local[closestIndex].done;
                    data[4] = local[closestIndex].invalid;
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
