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
                    right: 0,
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
            var l1, l2, l3, svg, containerBox, hoverLineGroup, clipPath, rectLifetime,
                rectTaskChain;
            var fiveShadesOfGrey = ['#c5cae9', '#7986cb', '#3f51b5', '#303f9f', '#1a237e'];
            // add data label
            $http.get('build/data-label.min.html').success(function (html) {
                element.prepend($compile(html)(scope));
            });

            // add main svg
            svg = d3.select(element[0])
                .append('svg:svg')
                .attr("viewBox", "0 -20 " + config.customWidth + " " + config.customHeight)
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("xmlns", "http://www.w3.org/2000/svg")
                .append("svg:g")
                .attr("transform", "translate(" + config.margin.left + "," + config.margin.top +
                    ")")
                .attr('style', 'fill: none');

            // Prevent hover over axis while moving
            clipPath = svg.append("svg:clipPath")
                .attr("id", "clip")
                .append("svg:rect")
                .attr("id", "clip-rect")
                .attr("x", "0")
                .attr("y", "0")
                .attr("width", width)
                .attr("height", height);

            // axes
            var x = d3.time.scale();
            var xAxis = d3.svg.axis().scale(x).tickSize(-height).ticks(4).tickSubdivide(1);
            var gx = svg.append("svg:g")
                .attr("class", "x axis minorx")
                .attr('fill', '#666')
                .attr("transform", "translate(0," + (height + 10) + ")")
                .call(xAxis);

            var y = d3.scale.linear();
            var yAxis = d3.svg.axis().scale(y).ticks(4).orient("left");
            var gy = svg.append("svg:g")
                .attr("class", "y axis minory")
                .attr('fill', '#666')
                .call(yAxis)
                .append("text")
                .attr("id", "ytitle")
                .attr("dy", "-20px")
                .attr("dx", '-5px')
                .style("text-anchor", "end")
                .attr("font-size", "13")
                .text('events');

            // define zoom
            var zoom = d3.behavior.zoom()
                .on("zoom", onZoom);

            // Draw lines
            var pathNotOpenEvents = d3.svg.area()
                .x(function(d) {
                    return x(d.t);
                })
                .y0(function(d) {
                    return y(d.d);
                })
                .y1(function(d) {
                    return y(d.e);
                })
                .interpolate("step-after");

            var pathOnlyDoneEvents = d3.svg.area()
                .x(function(d, i) {
                    return x(d.t);
                })
                .y0(function(d) {
                    return y(height);
                })
                .y1(function(d) {
                    return y(d.d);
                })
                .interpolate("step-after");

            var pathTargetEvents = d3.svg.area()
                .x(function(d, i) {
                    return x(d.t);
                })
                .y0(function(d) {
                    return y(d.e);
                })
                .y1(function(d) {
                    return y(d.x);
                })
                .interpolate("step-after");

            var taskChainLine = d3.svg.line()
                .x(function(d, i) {
                    return x(d.t);
                })
                .y(function(d) {
                    return y(d.e);
                })
                .interpolate("step-before");

            // Zoom
            function onZoom() {
                svg.select("g.x.axis").call(xAxis);
                svg.select("g.y.axis").call(yAxis);
                if (scope.taskChain) {
                    for (var i = 0; i < scope.dataCopy.length; i++) {
                        var name = scope.dataCopy[i].request.replace(/\//g, '');
                        svg.select('path.' + name).attr("d", taskChainLine(scope.dataCopy[i].data));
                        svg.select('path.v' + name).attr("d", taskChainLine(scope.dataCopy[i]
                            .data));
                    }
                } else {
                    svg.select("path.data1").attr("d", pathOnlyDoneEvents(scope.dataCopy));
                    svg.select("path.data2").attr("d", pathNotOpenEvents(scope.dataCopy));
                    svg.select("path.data3").attr("d", pathTargetEvents(scope.dataCopy));
                }
            }

            // Format y axis numbers
            function formatY(d) {
                if (d === 0) {
                    return 0;
                }
                var l = ['G', 'M', 'k', ''];
                var s, j = 0;
                for (var i = 1e9; i >= 1; i = i / 1e3) {
                    s = d / i;
                    if (s >= 1) {
                        return s + l[j];
                    }
                    j++;
                }
                return '';
            }

            // When new data to load
            var onLoad = function(a) {
                if (scope.taskChain) {
                    var yMax = 0;
                    scope.taskChainData = {};

                    // clear the graph
                    svg.selectAll('path').remove();
                    l1 = undefined;
                    l2 = undefined;
                    l3 = undefined;
                    if (clipPath !== undefined) {
                        clipPath.remove();
                        clipPath = undefined;
                    }
                    if (rectLifetime !== undefined) {
                        rectLifetime.remove();
                        rectLifetime = undefined;
                    }
                    if (hoverLineGroup !== undefined) {
                        hoverLineGroup.remove();
                        hoverLineGroup = undefined;
                    }
                    if (containerBox !== undefined) {
                        containerBox.remove();
                        containerBox = undefined;
                    }

                    // the monitor times for each dataset are the same
                    currentMin = d3.min(a[0].data, function(d) {
                        return d.t;
                    });
                    currentMax = d3.max(a[0].data, function(d) {
                        return d.t;
                    });

                    // Axes
                    x.domain([currentMin, currentMax]).range([0, width]);
                    xAxis.scale(x);
                    svg.selectAll("g .x.axis").transition().duration(200)
                        .ease("linear").call(xAxis);
                    for (var i = 0; i < a.length; i++) {
                        yMax = d3.max(a[i].data, function(d) {
                            return Math.max(d.x, d.e, yMax);
                        });
                    }
                    y.domain([0, yMax*1.1]).range([height, 0]);
                    yAxis.scale(y).tickFormat(formatY);
                    svg.selectAll("g .y.axis").transition().duration(200)
                        .ease("linear").call(yAxis);
                    d3.selectAll('.minory line').filter(function(d) {
                        return d;
                    }).transition().attr("x2", width);
                    zoom.x(x);
                    if (scope.zoomY) zoom.y(y);

                    // Prevent hover over axis while moving
                    clipPath = svg.append("svg:clipPath")
                    .attr("id", "clip")
                    .append("svg:rect")
                    .attr("id", "clip-rect")
                    .attr("x", "0")
                    .attr("y", "0")
                    .attr("width", width)
                    .attr("height", height);

                    // Draw lines
                    scope.taskChainData.time = "."
                    for (i = 0; i < a.length; i++) {
                        var c = fiveShadesOfGrey[i % fiveShadesOfGrey.length];
                        var n = a[i].request.split('\/')[3];
                        scope.taskChainData[n] = {
                                    dataset: a[i].request, color: c
                            };
                        svg.append("svg:path")
                            .attr("d", taskChainLine(a[i].data))
                            .attr("class", a[i].request.replace(/\//g, ''))
                            .style("stroke", c)
                            .style("stroke-width", 10)
                            .style("opacity", "0.8")
                            .attr("clip-path", "url(#clip)");
                    }

                    // Hover-over functionality
                    rectTaskChain = svg.append("rect")
                        .attr('id', 'lifetime')
                        .attr("class", "pane")
                        .attr("x", 0)
                        .style('cursor', 'move')
                        .style('fill', 'none')
                        .style('pointer-events', 'all')
                        .attr("width", width)
                        .attr("height", height)
                        .call(zoom);

                    constructDataLabel(true);
                    onZoom();
                } else {
                    if (l1 === undefined || l2 === undefined || l3 === undefined) {
                        // clean after taskchain
                        svg.selectAll('path').remove();
                        l1 = undefined;
                        l2 = undefined;
                        l3 = undefined;
                        if (clipPath !== undefined) {
                            clipPath.remove();
                            clipPath = undefined;
                        }
                        if (rectTaskChain !== undefined) {
                            rectTaskChain.remove();
                            rectTaskChain = undefined;
                        }
                        if (hoverLineGroup !== undefined) {
                            hoverLineGroup.remove();
                            hoverLineGroup = undefined;
                        }
                        if (containerBox !== undefined) {
                            containerBox.remove();
                            containerBox = undefined;
                        }
                    }
                    if (rectTaskChain !== undefined) {
                        rectTaskChain.remove();
                        rectTaskChain = undefined;
                    }
                    currentMin = d3.min(a, function(d) {
                        return d.t;
                    });
                    currentMax = d3.max(a, function(d) {
                        var max = d3.max(a, function(d) {
                            return d.t;
                        });
                        return d3.max(a, function(d) {
                            // focus only on relevant area
                            if (d.t === max) {
                                return 0;
                            }
                            return d.t;
                        });
                    });

                    // Axes
                    x.domain([currentMin, currentMax + (currentMax - currentMin) * 0.02])
                        .range(
                            [0, width]);
                    xAxis.scale(x);
                    svg.selectAll("g .x.axis").transition().duration(200).ease("linear").call(
                        xAxis);

                    y.domain([0, d3.max(a, function(d) {
                        return Math.max(d.x, d.e) * 1.1;
                    })]).range([height, 0]);
                    yAxis.scale(y).tickFormat(formatY);
                    svg.selectAll("g .y.axis").transition().duration(200).ease("linear").call(
                        yAxis);
                    d3.selectAll('.minory line').filter(function(d) {
                        return d;
                    }).transition().attr("x2", width);
                    zoom.x(x);
                    if (scope.zoomY) zoom.y(y);


                    // Draw lifetime
                    if (l3 === undefined) {
                        l3 = svg.append("svg:path")
                            .attr("d", pathTargetEvents(a))
                            .attr("class", "data3")
                            .attr('clip-path', 'url(#clip)')
                            .style('stroke-width', 1)
                            .style('stroke', '#263238')
                            .style('opacity', '0.4')
                            .style("fill", '#263238');
                    }
                    if (l2 === undefined) {
                        l2 = svg.append("svg:path")
                            .attr("d", pathNotOpenEvents(a))
                            .attr("class", "data2")
                            .attr('clip-path', 'url(#clip)')
                            .style('stroke-width', 1)
                            .style('stroke', '#ff6f00')
                            .style('opacity', '0.4')
                            .style("fill", '#ff6f00');
                    }
                    if (l1 === undefined) {
                        l1 = svg.append("svg:path")
                            .attr("d", pathOnlyDoneEvents(a))
                            .attr("class", "data1")
                            .attr('clip-path', 'url(#clip)')
                            .style('stroke-width', 1)
                            .style('stroke', '#01579b')
                            .style('opacity', '0.4')
                            .style("fill", '#01579b');
                    }
                    if (rectLifetime === undefined) {
                        rectLifetime = svg.append("rect")
                            .attr('id', 'lifetime')
                            .attr("class", "pane")
                            .attr("x", 0)
                            .style('cursor', 'move')
                            .style('fill', 'none')
                            .style('pointer-events', 'all')
                            .attr("width", width)
                            .attr("height", height)
                            .call(zoom);
                    }
                    l1.transition().duration(200).ease('linear').attr('d',
                        pathOnlyDoneEvents(a));
                    l2.transition().duration(400).ease('linear').attr('d',
                        pathNotOpenEvents(a));
                    l3.transition().duration(600).ease('linear').attr('d',
                        pathTargetEvents(a));

                    onZoom();
                    constructDataLabel();
                }
                svg.selectAll('.tick line').style('opacity', '0.2').style('stroke',
                    '#000000').style(
                    'stroke-width', '0.6').style('fill', 'none').style(
                    'stroke-dasharray',
                    '3px, 1px');
                svg.selectAll('.axis path').style('fill', 'none');
            };

            // Create a data label
            var constructDataLabel = function(taskchain) {
                if (containerBox === undefined) {
                    containerBox = document.querySelector('#lifetime');
                    hoverLineGroup = svg.append("svg:g").attr("class", "hover-line");
                    var hoverLine = hoverLineGroup.append("svg:line").attr("y1", 0).attr(
                        "y2",
                        height + 10).style('stroke-width', '1px').style('stroke',
                        '#777777');
                }

                var handleMouseOverGraph = function(event) {
                    var hoverLineXOffset = $(containerBox).offset().left;
                    var hoverLineYOffset = config.margin.top + $(containerBox).offset()
                        .top;
                    var mouseX = event.pageX - hoverLineXOffset;
                    var mouseY = event.pageY - hoverLineYOffset;

                    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <=
                        height) {
                        displayValueLabelsForPositionX(mouseX);
                    }
                };

                var updateIndicatorPosition = function(data) {
                    if (hoverLine !== undefined) {
                        hoverLine.attr("x1", data).attr("x2", data);
                    }
                };

                var updateDataLabel = function(data) {
                    if (taskchain) return null;
                    var tmp;
                    if (data[0]) {
                        tmp = data[0].toDateString() + ' ' + data[0].toLocaleTimeString();
                    } else {
                        tmp = '';
                    }
                    scope.labelData = [{
                        label: 'Time: ',
                        style: 'color: #90a4ae;',
                        data: tmp
                    }, {
                        label: 'Expected events: ',
                        style: 'color: #263238;',
                        data: data[1]
                    }, {
                        label: 'Events in DAS: ',
                        style: 'color: #ff6f00;',
                        data: data[2]
                    }, {
                        label: 'Done events in DAS: ',
                        style: 'color: #01579b;',
                        data: data[3]
                    }];
                };

                var displayValueLabelsForPositionX = function(xPosition) {
                    var tmp, data = [];
                    var s = xAxis.scale().domain();
                    var min = s[0].getTime();
                    var max = s[1].getTime();
                    var local = scope.dataCopy;
                    var measure = $('#measure').width();
                    if (measure <= 100) measure = 1140; //dirty
                    var w = measure * width / config.customWidth;
                    tmp = min + (xPosition / w * (max - min));
                    if (!taskchain) {
                        for (var i = 0; i < local.length; i++) {
                            if (tmp > local[i].t || i === 0) {
                                data[0] = local[i].t;
                                data[1] = local[i].x;
                                data[2] = local[i].e;
                                data[3] = local[i].d;
                            }
                        }
                    } else {
                        for (var i = local[0]['data'].length-1; i >= 0; i--) {
                            if (tmp > local[0]['data'][i].t || i === local[0]['data'].length-1) {
                                data[0] = local[0]['data'][i].t;
                                for (var j = 0; j < local.length; j++) {
                                    var key = local[j].request.split('\/')[3];
                                    scope.taskChainData[key].v = local[j].data[i].e;
                                }
                            } else {
                                break;
                            }
                        }
                    }
                    data[0] = new Date(data[0]);
                    if (taskchain) {
                    scope.taskChainData.time = data[0].toDateString() + ' ' + data[0].toLocaleTimeString();
                    }
                    updateDataLabel(data);
                    tmp = (data[0] - min) / ((max - min) / width);
                    updateIndicatorPosition(tmp);
                };

                // Watch for mouse events
                $(containerBox).mousemove(function(event) {
                    handleMouseOverGraph(event);
                });
                updateDataLabel([false, '', '', '']);
                displayValueLabelsForPositionX(1100);
            };

            var prepareData = function(d) {
                scope.dataCopy = angular.copy(d);
                onLoad(scope.dataCopy);
            };

            var onYZoomChange = function(d) {
                if (d) {
                    return zoom.y(y);
                } else {
                    return zoom.y(d3.scale.linear());
                }
            };

            // Watch for data change
            scope.$watch('zoomY', function(d) {
                onYZoomChange(d);
            });
            scope.$watch('chartData', function(d) {
                if (d !== undefined && d.length) prepareData(d);
            });
        }
    };
}])
