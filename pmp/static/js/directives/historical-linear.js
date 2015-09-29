    /*** 
    Life-Time Representation of Requests directive:
    ***/
    .directive('linearLifetime', ['$compile', function($compile) {
        return {
            restrict: 'AE',
            scope: {
                chartData: '=',
                humanReadableNumbers: '=',
                taskChain: '=',
                zoomY: '='
            },
            link: function(scope, element, compile) {
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
                var l1, l2, l3, containerBox, hoverLineGroup, clipPath, rectLifetime, rectTaskChain;
                var fiveShadesOfGrey = ['#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784', '#aed581', '#dce775'];
                // add data label
                var innerHtml = '<div ng-hide="taskChain" class="hidden-sm hidden-xs"><span ng-repeat=\'d in labelData\' style=\'{{d.style}}\'>{{d.label}}<span ng-show=\'humanReadableNumbers && d.label != "Time: "\'>{{d.data | readableNumbers}}</span><span ng-hide=\'humanReadableNumbers && d.label != "Time: "\'>{{d.data}}</span></span></div>';
                element.append($compile(innerHtml)(scope));

                // add main svg
                var svg = d3.select(element[0])
                    .append('svg:svg')
                    .attr("viewBox", "0 -20 " + config.customWidth + " " + config.customHeight)
                    .attr("width", "100%")
                    .attr("height", "100%")
                    .append("svg:g")
                    .attr("transform", "translate(" + config.margin.left + ","
                          + config.margin.top + ")")
                    .attr('style', 'fill: none');

                // define zoom
                var zoom = d3.behavior.zoom()
                    .on("zoom", onZoom);

                // axes
                var x = d3.time.scale();
                var y = d3.scale.linear();

                var xAxis = d3.svg.axis().scale(x).tickSize(-height).ticks(4).tickSubdivide(1);
                var gx = svg.append("svg:g")
                    .attr("class", "x axis minorx")
                    .attr('fill', '#666')
                    .attr("transform", "translate(0," + (height + 10) + ")")
                    .call(xAxis);

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

                // data-label
                var dateLabelGroup = svg.append("svg:g")
                    .attr("class", "date-label-group")
                    .attr("font-size", "14");
                dateLabelGroup.append("svg:text")
                    .attr("class", "date-label")
                    .attr('fill', '#263238')
                    .attr("y", -15)
                    .attr("x", 10);

                var defs = svg.append("defs");

                // Prevent hover over axis while moving
                var clipPath = defs.append("svg:clipPath")
                    .attr("id", "clip")
                    .append("svg:rect")
                    .attr("id", "clip-rect")
                    .attr("x", "0")
                    .attr("y", "0")
                    .attr("width", width)
                    .attr("height", height);

                var chartBody = svg.append("g")
                    .attr("clip-path", "url(#clip)");
                
                // Draw lines
                var pathNotOpenEvents = d3.svg.area()
                    .x(function(d) {
                        return x(d.t);
                    })
                    .y0(function(d){
                        return y(d.d)
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
                    .interpolate("step-after");

                // Zoom
                function onZoom() {
                    svg.select("g.x.axis").call(xAxis);
                    svg.select("g.y.axis").call(yAxis);
                    if (scope.taskChain) {
                        for (var i = 0; i < scope.dataCopy.length; i++) {
                            var name = scope.dataCopy[i].request.replace(/\//g, '');
                            svg.select('path.' + name).attr("d", taskChainLine(scope.dataCopy[i].data));
                            svg.select('path.v' + name).attr("d", taskChainLine(scope.dataCopy[i].data));
                        }
                    } else {
                        svg.select("path.data1").attr("d", pathOnlyDoneEvents(scope.dataCopy));
                        svg.select("path.data2").attr("d", pathNotOpenEvents(scope.dataCopy));
                        svg.select("path.data3").attr("d", pathTargetEvents(scope.dataCopy));
                    }
                }
                
                // Format y axis numbers
                function formatY(d) {
                    if (d == 0) {
                        return 0;
                    }
                    var l = ['G', 'M', 'k', ''];
                    var s, j = 0
                    for (var i = 1e9; i >= 1; i = i / 1e3) {
                        s = d / i;
                        if (s >= 1) {
                            return s + l[j]
                        }
                        j++;
                    }
                    return '';
                }

                // When new data to load
                var onLoad = function(a) {
                    if (scope.taskChain) {
                        // remove
                        if (l1 != undefined) {
                            l1.remove();
                            l1 = undefined;
                        }
                        if (l2 != undefined) {
                            l2.remove();
                            l2 = undefined;
                        }
                        if (l3 != undefined) {
                            l3.remove();
                            l3 = undefined;
                        }
                        if (clipPath != undefined) {
                            svg.selectAll('clipPath').remove();
                            clipPath = undefined;
                        }
                        if (rectLifetime != undefined) {
                            rectLifetime.remove();
                            rectLifetime = undefined
                        }
                        svg.select('text.date-label').text('');
                        if (hoverLineGroup != undefined) {
                            hoverLineGroup.remove();
                            hoverLineGroup = undefined;
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
                        var yMax = 0;
                        for (var i = 0; i < a.length; i++) {
                            yMax = d3.max(a[0].data, function(d) {
                                    return Math.max(d.x, d.e, yMax);
                                });
                        }
                        yMax *= 1.1;
                        y.domain([0, yMax]).range([height, 0]);
                        yAxis.scale(y).tickFormat(formatY);
                        svg.selectAll("g .y.axis").transition().duration(200)
                        .ease("linear").call(yAxis);
                        d3.selectAll('.minory line').filter(function(d) {
                                return d;
                                }).transition().attr("x2", width);
                        zoom.x(x);
                        if (scope.zoomY) zoom.y(y);

                        // Prevent hover over axis while moving
                        clipPath = svg.append("clipPath")
                        .attr("id", "clip")
                        .append("rect")
                        .attr("x", 1)
                        .attr("y", 0)
                        .attr("width", width)
                        .attr("height", height);

                        // Draw lines
                        for (var i = 0; i < a.length; i++) {
                            var c = fiveShadesOfGrey[i % fiveShadesOfGrey.length]; 
                            svg.append("svg:path")
                                .attr("d", taskChainLine(a[i].data))
                                .attr("class", a[i].request.replace(/\//g, ''))
                                .style('stroke-width', 1.5)
                                .style('stroke', c)
                                .attr("clip-path", "url(#clip)");
                        }

                        // Hover-over functionality
                        rectTaskChain = svg.append("rect")
                        .attr('id', 'lifetime')
                        .attr('class', 'pane')
                        .attr('x', 1)
                        .style('cursor', 'move')
                        .style('fill', 'none')
                        .style('pointer-events', 'all')
                        .attr('width', width)
                        .attr('height', height)
                        .call(zoom);

                        for (var i = 0; i < a.length; i++) {
                            var t = svg.append('svg:path')
                                .attr('d', taskChainLine(a[i].data))
                                .attr('class', 'v' + a[i].request.replace(/\//g, ''))
                                .attr('name', a[i].request)
                                .attr('clip-path', 'url(#clip)')
                                .style('stroke-width', 3)
                                .style('fill','none')
                                .style('pointer-events','all')
                                .style('stroke', 'none')
                                .append('title')
                                .text(function(d) { return a[i].request});
                            svg.select('path.v' + a[i].request.replace(/\//g, ''))
                                .on('mouseover', function(d) {
                                    var tmp = d3.select(this);
                                    tmp.style('stroke',  '#aeea00');
                                    updateDataLabel('Dataset: ' + tmp.attr('name'))
                                        }).on('mouseout', function(d) {
                                                d3.select(this).style('stroke', 'none');
                                                updateDataLabel('');
                                            });
                        }

                        var updateDataLabel = function(data) {
                            svg.select('text.date-label').text(data);
                        }

                        onZoom();
                    } else {
                        if (l1 == undefined) {
                            svg.selectAll('path').remove();
                        }
                        if (l2 == undefined) {
                            svg.selectAll('path').remove();
                        }
                        if (l3 == undefined) {
                            l3 = undefined
                            svg.selectAll('path').remove();
                        }
                        if (rectTaskChain != undefined) {
                            rectTaskChain.remove();
                            rectTaskChain = undefined;
                        }

                        currentMin = d3.min(a, function(d) {
                            return d.t;
                        });
                        currentMax = d3.max(a, function(d) {
                            var max = d3.max(a, function(d) { return d.t});
                            return d3.max(a, function(d) {
                                if (d.t === max) { return 0 };
                                return d.t
                            });
                        });

                        // Axes
                        x.domain([currentMin, currentMax+(currentMax-currentMin)*0.02]).range([0, width]);
                        xAxis.scale(x);
                        svg.selectAll("g .x.axis").transition().duration(200).ease("linear").call(xAxis);

                        y.domain([0, d3.max(a, function(d) {
                            return Math.max(d.x, d.e) * 1.1;
                        })]).range([height, 0]);
                        yAxis.scale(y).tickFormat(formatY);
                        svg.selectAll("g .y.axis").transition().duration(200).ease("linear").call(yAxis);
                        d3.selectAll('.minory line').filter(function(d) { return d;
                            }).transition().attr("x2", width);
                        zoom.x(x);
                        if (scope.zoomY) zoom.y(y);

                        // Draw lifetime
                        if (l3 == undefined) {
                            l3 = chartBody.append("svg:path")
                            .attr("d", pathTargetEvents(a))
                            .attr("class", "data3")
                            .style('stroke-width', 1)
                            .style('stroke', '#263238')
                            .style('opacity', '0.4')
                            .style("fill", '#263238');
                        }                        
                        if (l2 == undefined) {
                            l2 = chartBody.append("svg:path")
                            .attr("d", pathNotOpenEvents(a))
                            .attr("class", "data2")
                            .style('stroke-width', 1)
                            .style('stroke', '#ff6f00')
                            .style('opacity', '0.4')
                            .style("fill", '#ff6f00');
                        }
                        if (l1 == undefined) {
                            l1 = chartBody.append("svg:path")
                            .attr("d", pathOnlyDoneEvents(a))
                            .attr("class", "data1")
                            .style('stroke-width', 1)
                            .style('stroke', '#01579b')
                            .style('opacity', '0.4')
                            .style("fill", '#01579b');
                        }
                        if (rectLifetime == undefined) {
                            rectLifetime = chartBody.append("rect")
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
                        l1.transition().duration(200).ease('linear').attr('d', pathOnlyDoneEvents(a));
                        l2.transition().duration(400).ease('linear').attr('d', pathNotOpenEvents(a));
                        l3.transition().duration(600).ease('linear').attr('d', pathTargetEvents(a));

                        constructDataLabel();
                        onZoom();
                    }
                    svg.selectAll('.tick line').style('opacity', '0.2').style('stroke', '#000000').style('stroke-width', '0.6').style('fill', 'none').style('stroke-dasharray', '3px, 1px');
                    svg.selectAll('.axis path').style('fill', 'none');
                }

                // Create a data label
                var constructDataLabel = function() {
                    if (containerBox == undefined) {
                        containerBox = document.querySelector('#lifetime');
                        hoverLineGroup = chartBody.append("svg:g").attr("class", "hover-line");
                        var hoverLine = hoverLineGroup.append("svg:line").attr("y1", 0).attr("y2", height + 10).style('stroke-width', '1px').style('stroke', '#777777');
                    }

                    var handleMouseOverGraph = function(event) {
                        var hoverLineXOffset = $(containerBox).offset().left;
                        var hoverLineYOffset = config.margin.top + $(containerBox).offset().top;
                        var mouseX = event.pageX - hoverLineXOffset;
                        var mouseY = event.pageY - hoverLineYOffset;

                        if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
                            displayValueLabelsForPositionX(mouseX);
                        }
                    }

                    var updateIndicatorPosition = function(data) {
                        if (hoverLine != undefined) {
                            hoverLine.attr("x1", data).attr("x2", data);
                        }
                    }

                    var updateDataLabel = function(data) {
                        var tmp;
                        if (data[0]) {
                            tmp = data[0].toDateString() + ' ' + data[0].toLocaleTimeString();
                        } else {
                            tmp = ''
                        }
                        scope.labelData = [{label: 'Time: ', style: 'color: #90a4ae; position: absolute; left: 0px', data: tmp}, {label: 'Expected events: ', style: 'color: #263238; position: absolute; left: 250px', data: data[1]}, {label: 'Events in DAS: ', style: 'color: #ff6f00; position: absolute; left: 450px', data: data[2]}, {label: 'Done events in DAS: ', style: 'color: #01579b; position: absolute; left: 650px', data: data[3]}];
                    }

                    var displayValueLabelsForPositionX = function(xPosition) {
                        var tmp, data = [];
                        var s = xAxis.scale().domain();
                        var min = s[0].getTime();
                        var max = s[1].getTime();
                        var local = scope.dataCopy;
                        var w = $('#measure').width() * width / config.customWidth;

                        tmp = min + (xPosition/ w * (max - min));

                        for (var i = 0; i < local.length; i++) {
                            if (tmp > local[i].t || i == 0) {
                                data[0] = local[i].t;
                                data[1] = local[i].x;
                                data[2] = local[i].e;
                                data[3] = local[i].d;
                            }
                        }
                        data[0] = new Date(data[0]);
                        updateDataLabel(data);
                        tmp = (data[0] - min) / ((max - min) / width);
                        updateIndicatorPosition(tmp);
                    }

                    // Watch for mouse events
                    $(containerBox).mousemove(function(event) {
                        handleMouseOverGraph(event);
                    });
                    updateDataLabel([false, '', '', '']);
                    displayValueLabelsForPositionX(1100);
                }

                var prepareData = function(d) {
                    scope.dataCopy = angular.copy(d);
                    onLoad(scope.dataCopy);
                }

                var onYZoomChange = function(d) {
                    d ? zoom.y(y) : zoom.y(d3.scale.linear());
                }

                // Watch for data change
                scope.$watch('zoomY', function(d) {onYZoomChange(d)});
                scope.$watch('chartData', function(d) {if (d !== undefined && d.length) prepareData(d);});
            }
        }
            }])