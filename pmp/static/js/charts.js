// for multi-transitions
function endall(transition, callback) {
                        var n = 0;
                        transition
                            .each(function() { ++n; })
                            .each("end", function() { if (!--n) callback.apply(this, arguments); });
      }

angular.module('mcm.charts', [])
    /*** 
    Life-Time Representation of Requests directive:
    ***/
    .directive('linearLifetime', function() {
        return {
            restrict: 'AE',
            scope: {
                chartData: '=',
                    taskChain: '=',
                zoomY: '='
            },
                link: function(scope, element) {
                scope.dataCopy = [];
                var customWidth = 1160;
                // General attributes
                var margin = {
                        top: 10,
                        right: 0,
                        bottom: 50,
                        left: 50
                    },
                    width = customWidth - margin.left - margin.right,
                    height = 500 - margin.top - margin.bottom,
                        l1, l2, l3, containerBox, hoverLineGroup, clipPath, rectLifetime, rectTaskChain;
                
                var fiveShadesOfGrey = ['#212121', '#424242', '#616161', '#757575', '#9e9e9e'];
                var svg = d3.select(element[0])
                    .append('svg:svg')
                    .attr("viewBox", "0 -20 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom))
                    .attr("width", "100%")
                    .attr("height", "100%")
                    .append("svg:g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
                    .attr('style', 'fill: none');

                var zoom = d3.behavior.zoom()
                    .on("zoom", onZoom);

                // Axes
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

                // Data-label
                var dateLabelGroup = svg.append("svg:g")
                    .attr("class", "date-label-group")
                    .attr("font-size", "14");
                dateLabelGroup.append("svg:text")
                    .attr("class", "date-label")
                    .attr("style", "fill: #263238")
                    .attr("y", -15)
                    .attr("x", 10);
                dateLabelGroup.append("svg:text")
                    .attr("class", "expected-label")
                    .attr('style', 'fill: #b71c1c')
                    .attr("y", -15)
                    .attr("x", 250);
                dateLabelGroup.append("svg:text")
                    .attr("class", "indas-label")
                    .attr("style", "fill: #689f38")
                    .attr("y", -15)
                    .attr("x", 420);
                dateLabelGroup.append("svg:text")
                    .attr("class", "openindas-label")
                    .attr("style", "fill:  #607d8b;")
                    .attr("y", -15)
                    .attr("x", 620);

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

                // Area gradient
                var gradient = defs.append("linearGradient")
                    .attr("id", "gradient")
                    .attr("x2", "0%")
                    .attr("y2", "100%");
                gradient.append("stop")
                    .attr("offset", "0%")
                    .attr('stop-color', '#607d8b')
                    .attr("stop-opacity", 0.4);
                gradient.append("stop")
                    .attr("offset", "100%")
                    .attr('stop-color', '#eceff1')
                    .attr("stop-opacity", 0.8);

                var chartBody = svg.append("g")
                    .attr("clip-path", "url(#clip)");
                //.call(d3.behavior.zoom().scaleExtent([0.2, 5]).on("zoom", redraw));
                
                // Draw lines
                var areaAllEvents = d3.svg.area()
                    .x(function(d) {
                        return x(d.t);
                    })
                    .y0(y(height))
                    .y1(function(d) {
                        return y(d.a);
                    })
                    .interpolate("step-after");

                var pathNotOpenEvents = d3.svg.line()
                    .x(function(d) {
                        return x(d.t);
                    })
                    .y(function(d) {
                        return y(d.e);
                    })
                    .interpolate("step-after");

                var pathTargetEvents = d3.svg.line()
                    .x(function(d, i) {
                        return x(d.t);
                    })
                    .y(function(d) {
                        return y(d.x);
                    })
                    .interpolate("step-after");

                var taskChainLine = d3.svg.line()
                    .x(function(d, i) {
                        return x(d.t);
                    })
                    .y(function(d) {
                        return y(d.a);
                    })
                    .interpolate("step-after");

                // Zoom
                function onZoom() {
                    svg.select("g.x.axis").call(xAxis);
                    svg.select("g.y.axis").call(yAxis);
                    if (scope.taskChain) {
                        svg.select("path.data3").attr("d", pathTargetEvents(scope.dataCopy[0].data));
                        svg.select("path.vdata3").attr("d", pathTargetEvents(scope.dataCopy[0].data));
                        for (var i = 0; i < scope.dataCopy.length; i++) {
                            var name = scope.dataCopy[i].request.replace(/\//g, '');
                            svg.select('path.' + name).attr("d", taskChainLine(scope.dataCopy[i].data));
                            svg.select('path.v' + name).attr("d", taskChainLine(scope.dataCopy[i].data));
                        }
                    } else {
                        svg.select("path.data1").attr("d", areaAllEvents(scope.dataCopy));
                        svg.select("path.data2").attr("d", pathNotOpenEvents(scope.dataCopy));
                        svg.select("path.data3").attr("d", pathTargetEvents(scope.dataCopy));
                    }
                }
                
                // Format y axis numbers
                function formatY(d) {
                    var l = ['G', 'M', 'k', ''];
                    var s, j = 0
                    for (var i = 1e9; i > 0; i = i / 1e3) {
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
                        if (rect != undefined) {
                            rect.remove();
                            rect = undefined
                        }
                        svg.select('text.date-label').text('');
                        svg.select('text.expected-label').text('');
                        svg.select('text.indas-label').text('');
                        svg.select('text.openindas-label').text('');

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
                                    return Math.max(d.x, d.a, yMax);
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
                                .style('stroke-width', 2)
                                .style('stroke', c)
                                .attr("clip-path", "url(#clip)");
                        }

                        if (l3 == undefined) {
                            l3 = svg.append("svg:path")
                            .attr("d", pathTargetEvents(a[0].data))
                            .attr("class", "data3")
                            .attr("clip-path", "url(#clip)")
                            .style('stroke-width', 2)
                            .style('stroke', '#b71c1c');
                        }
                        l3.transition().duration(600)
                        .ease('linear').attr("d", pathTargetEvents(a[0].data));

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
                                .style('stroke-width', 2)
                                .style('fill','none')
                                .style('pointer-events','all')
                                .style('stroke', 'none')
                                .append('title')
                                .text(function(d) { return a[i].request});
                            svg.select('path.v' + a[i].request.replace(/\//g, ''))
                                .on('mouseover', function(d) {
                                    var tmp = d3.select(this);
                                    tmp.style('stroke',  '#9c27b0');
                                    updateDataLabel('Dataset: ' + tmp.attr('name'))
                                        }).on('mouseout', function(d) {
                                                d3.select(this).style('stroke', 'none');
                                                updateDataLabel('');
                                            });
                        }

                        svg.append('svg:path')
                        .attr('d', pathTargetEvents(a[0].data))
                        .attr('class', 'vdata3')
                        .attr('name', 'Expected events')
                        .attr('clip-path', 'url(#clip)')
                        .style('stroke-width', 2)
                        .style('fill','none')
                        .style('pointer-events','all')
                        .style('stroke', 'none')
                        .append('title')
                        .text(function(d) { return 'Expected events' });

                        var updateDataLabel = function(data) {
                            svg.select('text.date-label').text(data);
                        }

                        onZoom();
                    } else {
                        if (l1 == undefined && l2 == undefined) {
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
                            return d.t;
                        });

                        // Axes
                        x.domain([currentMin, currentMax]).range([0, width]);
                        xAxis.scale(x);
                        svg.selectAll("g .x.axis")
                        .transition().duration(200).ease("linear").call(xAxis);

                        y.domain([0, d3.max(a, function(d) {
                            return Math.max(d.x, d.a) * 1.1;
                        })]).range([height, 0]);
                        yAxis.scale(y).tickFormat(formatY);
                        svg.selectAll("g .y.axis")
                        .transition().duration(200).ease("linear").call(yAxis);
                        d3.selectAll('.minory line').filter(function(d) {
                            return d;
                        }).transition().attr("x2", width);
                        zoom.x(x);
                        if (scope.zoomY) zoom.y(y);

                    // Draw lifetime
                        if (l1 == undefined) { 
                            l1 = chartBody.append("svg:path")
                                .attr("d", areaAllEvents(a))
                                .attr('class', 'data1')
                                .style('stroke-width', 2)
                                .style('stroke', '#607d8b')
                                .style("fill", "url(#gradient)");
                        }
                        if (l2 == undefined) {
                            l2 = chartBody.append("svg:path")
                                .attr("d", pathNotOpenEvents(a))
                                .attr("class", "data2")
                                .style('stroke-width', 2)
                                .style('stroke', '#689f38');
                        }
                        if (l3 == undefined) {
                            l3 = chartBody.append("svg:path")
                                .attr("d", pathTargetEvents(a))
                                .attr("class", "data3")
                                .style('stroke-width', 2)
                                .style('stroke', '#b71c1c');
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
                        l1.transition().duration(200).ease('linear').attr('d', areaAllEvents(a));
                        l2.transition().duration(400).ease('linear').attr('d', pathNotOpenEvents(a));
                        l3.transition().duration(600).ease('linear').attr('d', pathTargetEvents(a));

                        constructDataLabel();
                        onZoom();
                    }
                }

                // Create a data label
                var constructDataLabel = function() {
                    if (containerBox == undefined) {
                        containerBox = document.querySelector('#lifetime');
                        var hoverLineXOffset = $(containerBox).offset().left;
                        var hoverLineYOffset = margin.top + $(containerBox).offset().top;

                        hoverLineGroup = chartBody.append("svg:g")
                            .attr("class", "hover-line");

                        var hoverLine = hoverLineGroup
                        .append("svg:line")
                        .attr("y1", 0).attr("y2", height + 10);
                    }

                    var handleMouseOverGraph = function(event) {
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
                        if (data[0]) {
                            svg.select('text.date-label').text('Time: ' + data[0].toDateString() + ' ' + data[0].toLocaleTimeString());
                        } else {
                            svg.select('text.date-label').text('Time: ');
                        }
                        svg.select('text.expected-label').text('Expected: ' + data[1]);
                        svg.select('text.indas-label').text('Events in DAS: ' + data[2]);
                        svg.select('text.openindas-label').text('All events in DAS: ' + data[3]);
                    }

                    var displayValueLabelsForPositionX = function(xPosition) {
                        var tmp, data = [];
                        var s = xAxis.scale().domain();
                        var min = s[0].getTime();
                        var max = s[1].getTime();
                        var local = scope.dataCopy;
                        var w = $('#measure').width() * width / customWidth;

                        tmp = min + (xPosition/ w * (max - min));

                        for (var i = 0; i < local.length; i++) {
                            if (tmp > local[i].t || i == 0) {
                                data[0] = local[i].t;
                                data[1] = local[i].x;
                                data[2] = local[i].e;
                                data[3] = local[i].a;
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
                }

                var prepareData = function(d) {
                    scope.dataCopy = angular.copy(d);
                    onLoad(scope.dataCopy);
                }

                // Watch for data change
                scope.$watch('chartData', function(d) {
                    if (d.length) {
                        prepareData(d);
                    }
                });
            }
        }
    })

    .directive('mcmDonutChart', function() {
        return {
            restrict: 'AE',
            scope: {
                outerRadius: '=?',
                innerRadius: '=?',
                innerTitle: '@',
                fontSize: '=?',
                domain: '=?',
                colorMap: '=?',
                onClick: '=?',
                onClickTitle: '=?',
                data: '='
            },

            link: function(scope, element, attrs) {

                // Setup default parameters.
                var outerRadius = scope.outerRadius || 200;
                var innerRadius = scope.innerRadius || 0;
                var fontSize = scope.fontSize || 26;
                var duration = 800;
                var color = undefined;

                var field = attrs.data.split('.').pop().toLowerCase();

                // User can define a color-map so use look for one.
                // If none is found, then use built-in color pallete
                // but see if user has defined a domain of values.
                if (scope.colorMap === undefined) {
                    color = d3.scale.category10();
                    if (scope.domain !== undefined) {
                        color.domain(scope.domain);
                    }
                } else {
                    color = function(term) {
                        return scope.colorMap[term];
                    }
                }

                // width and height
                var w = (outerRadius * 2)+fontSize * 5;
                var h = outerRadius * 2 + fontSize * 3;

                var arc = d3.svg.arc()
                    .outerRadius(outerRadius - 10)
                    .innerRadius(innerRadius);

                var pie = d3.layout.pie()
                    .sort(null)
                    .value(function(d) { return d.count; });

                var svg = d3.select(element[0])
                    .append('svg')
                    .attr('width', w).attr('height', h);

                var arcs = svg.append('g')
                    .attr('transform', 'translate(' + (w/2) + "," + (h/2) + ') rotate(180) scale(-1, -1)');

                var labels = svg.append("g")
                    .attr("class", "label_group")
                    .attr("transform", "translate(" + (w/2) + "," + (h/2) + ")");

                function setTitleForTitle() {
                    var data = "";
                    for(var i=0; i<scope.data.terms.length; i++) {
                        data += "\n" + scope.data.terms[i].term + ": " + scope.data.terms[i].count;//.toLocaleString();
                    }
                    return scope.innerTitle + data;
                }

                var innerTitle = labels.append("g")
                    .append("svg:text")
                    .attr("text-anchor", "middle")
                    .attr('font-size', fontSize-8)
                    .attr('font-weight', 'bold')
                    .attr("transform", "translate(0," + (((fontSize-8)/5)+1) + ")");

                d3.select(innerTitle.node().parentNode)
                    .append('title')
                    .text(function(){return setTitleForTitle()});

                if(scope.onClickTitle) {
                    innerTitle
                        .attr('cursor', 'pointer')
                        .on('mousedown', function(d) {
                            scope.$apply(function() {
                                (scope.onClickTitle || angular.noop)(field, scope.innerTitle, scope.data.status);
                            });
                        });
                }

                attrs.$observe('innerTitle', function(v){
                    innerTitle.text(v);
                    d3.select(innerTitle.node().parentNode).select('title').text(setTitleForTitle());
                });

                scope.$watch('data', function(data) {
                    d3.select(innerTitle.node().parentNode).select('title').text(setTitleForTitle());

                    function arcTween(d, i2) {
                        var i = d3.interpolate(this._current, d);
                        this._current = i(0);
                        return function(t) {
                            return arc(i(t));
                        };
                    }

                    function arcTweenExit(d, i2) {
                        var i = d3.interpolate(d, {data:d.data, startAngle: d.startAngle, endAngle: d.startAngle, value:0});
                        return function(t) {
                            return arc(i(t));
                        };
                    }

                    function textTween(d, i) {
                        var a = (this._current.startAngle + this._current.endAngle - Math.PI)/2;
                        var b = (d.startAngle + d.endAngle - Math.PI)/2;
                        this._current=d;
                        var fn = d3.interpolateNumber(a, b);
                        return function(t) {
                            var val = fn(t);
                            return "translate(" +
                                Math.cos(val) * (outerRadius-5) + "," +
                                Math.sin(val) * (outerRadius-5) + ")";
                        };
                    }

                    var findAnchor = function(d) {
                        if ((d.startAngle + d.endAngle)/2 < Math.PI ) {
                            return "beginning";
                        } else {
                            return "end";
                        }
                    };
//                    if data is not null
                    if (data) {
                        // pull out the terms array from the facet
                        var data_insides = data.terms || [];
                        var pieData = pie(data_insides);

                        // calculate the sum of the counts for this facet
                        var sum = 0;
                        for (var ii=0; ii < data_insides.length; ii++) {
                            sum += data_insides[ii].count;
                        }

                        // if the sum is 0 then this facet has no valid entries (all counts were zero)
                        if (sum > 0) {
                            // update the arcs
                            var path = arcs.selectAll('path').data(pieData);

                            path.each(function(d){
                                d3.select(this)
                                    .select("title")
                                    .text(d.data.term + "\n" + d.value + " (" + ((d.value/sum)*100).toFixed(1) + "%)");
                            });

                            path.enter()
                                .append('path')
                                    .attr('d', arc)
                                    .attr('stroke', '#fff')
                                    .attr('stroke-width', '1.5')
                                    .style('fill', function(d) { return color(d.data.term); })
                                    .each(function(d) { this._current = {data:d.data, startAngle: d.startAngle, endAngle: d.startAngle, value:0}; })
                                .append('title')
                                .text(function(d){
                                    return d.data.term + "\n" + d.value + " (" + ((d.value/sum)*100).toFixed(1) + "%)";
                                    //return d.data.term + "\n" + d.value.toLocaleString() + " (" + ((d.value/sum)*100).toFixed(1) + "%)";
                                });

                            if(scope.onClick) {
                                path
                                    .attr('cursor', 'pointer')
                                    .on('mousedown', function(d) {
                                        scope.$apply(function() {
                                            (scope.onClick || angular.noop)(field, d.data.term, scope.data.status);
                                        });
                                    });
                            }

                            path
                                .on("mouseover", function() {
                                    this.parentNode.appendChild(this);
                                    d3.select(this).attr('stroke', '#AAA');
                                })
                                .on("mouseout", function() {
                                    d3.select(this).attr('stroke', '#fff');
                                })
                                .transition()
                                .style('fill', function(d) { return color(d.data.term); })
                                .duration(duration)
                                .attrTween('d', arcTween);

                            // remove arcs not in the dataset
                            path.exit()
                                .transition()
                                .duration(duration)
                                .attrTween('d', arcTweenExit)
                                .remove();

                            // update the percent labels
                            var percentLabels = labels
                                .selectAll("text.value")
                                .data(pieData.length<=2 ? pieData.filter(function(d){return d.value}) : pieData.filter(function(d){return d.value/sum>0.05}));

                            percentLabels.enter().append("text")
                                .attr("class", "value")
                                .attr('font-size', fontSize-10)
                                .attr('font-weight', 'bold')
                                .attr("transform", function(d) {
                                    return "translate(" +
                                        Math.cos(((d.startAngle + d.endAngle - Math.PI)/2)) * (outerRadius) + "," +
                                        Math.sin((d.startAngle + d.endAngle - Math.PI)/2) * (outerRadius) + ")";
                                })
                                .each(function(d) {this._current = d;});


                            percentLabels.attr('text-anchor', findAnchor)
                                .text(function(d){
                                    return ((d.value/sum)*100).toFixed(1) + "%";
                                });

                            // run the transition
                            percentLabels
                                .transition()
                                .duration(duration)
                                .attr("dy", function(d) {
                                    if ((d.startAngle + d.endAngle)/2 > Math.PI/2 && (d.startAngle + d.endAngle)/2 < Math.PI*1.5 ) {
                                        return 17;
                                    } else {
                                        return -17;
                                    }
                                })
                                .attrTween("transform", textTween);

                            // flush old entries
                            percentLabels.exit().remove();

                            // update the value labels
                            var nameLabels = labels.selectAll("text.units").data(pieData.length<=2 ? pieData.filter(function(d){return d.value}) : pieData.filter(function(d){return d.value/sum>0.05}));

                            nameLabels.enter()
                                .append("text")
                                .attr("class", "units")
                                .attr('font-size', fontSize-12)
                                .attr('stroke', 'none')
                                .attr("transform", function(d) {
                                    return "translate(" +
                                        Math.cos(((d.startAngle + d.endAngle - Math.PI)/2)) * (outerRadius) + "," +
                                        Math.sin((d.startAngle + d.endAngle - Math.PI)/2) * (outerRadius) + ")";
                                })
                                .each(function(d) {this._current = d;});

                            nameLabels
                                .attr('text-anchor', findAnchor)
                                .text(function(d){
                                    return d.data.term;
                                });

                            // run the transition
                            nameLabels
                                .transition()
                                .duration(duration)
                                .attr("dy", function(d){
                                    if ((d.startAngle + d.endAngle)/2 > Math.PI/2 && (d.startAngle + d.endAngle)/2 < Math.PI*1.5 ) {
                                        return fontSize+6;
                                    } else {
                                        return fontSize-28;
                                    }
                                })
                                .attrTween("transform", textTween);

                            // flush old entries
                            nameLabels.exit().remove();

                        } else {
                            // if the facet had no valid entries then remove the chart
                            svg.selectAll('path').remove();
                            labels.selectAll('line').remove();
                            labels.selectAll("text.value").remove();
                            labels.selectAll("text.units").remove();
                        }
                    }
                }, true);

            }
        };
    })
    .directive('mcmColumnChart', function(){
        return {
            restrict: 'AE',
            scope: {
                data: '=', // data to be used
                value: '=?', // which value to use for calculations
                grouping: '=?', // horizontal splitting
                columns: '=?coloring', // how to do and color last horizontal split
                stacking: '=?', // how to vertically divide each column
                yScaleType: '=?scale', // "linear" or "log"
                valueOperation: '=?mode', // events, requests or seconds
                responsive: '=?', // should the chart be responsive to the webpage size
                duration: '=?', // duration of animations
                legend: '=?', // should the color legend be shown
                userWidth: '=?width', // optional width of chart
                userHeight: '=?height', // optional height of chart
                sort: '=?' // should the values in columns be sorted
            },
            link: function(scope, element, attrs) {
                var highlight_color = "#bdbdbd";
                var margin = {top: 20, right: 50, bottom: 150, left: 50};
                //input data
                var data, value, grouping, columns, stacking, yScaleType, valueOperation,
                    duration;
                // visuals
                var column_width, width, height, max_column_width, x_scale, y_scale, svg_group,
                    xAxis, yAxis, main_svg, svg;
                //internal data
                var nested, nested_data, sums, columns_domain, rows_color_domain, rows_domains,
                    colors_stacks,
                    scales = {};

                // create base SVG (and translate it to the start of plot)
                main_svg = d3.select(element[0]).append("svg")
                    .attr("preserveAspectRatio", "xMidYMin meet");
                svg = main_svg.append("g");

                // attach xAxis
                svg.append("g")
                    .attr("class", "x axis");

                // attach yAxis
                svg.append("g")
                    .attr("class", "y axis")
                    .append("text")
                    .attr("id", "ytitle")
                    .style("text-anchor", "end")
                    .attr("dy", "1em")
                    .attr("transform", function() {
                        return "rotate(-90)"
                        });

                svg.append("g")
                    .attr("class", "grid horizontal");

                var colorMap = {
                    approved: '#4caf50', // green 500
                    defined: '#f44336', // red 500
                    done: '#2196f3', // blue 500
                    new: '#ff9800', // orange 500
                    submitted: '#9c27b0', // purple 500
                    upcoming: '#e91e63', // pink 500
                    validation: '#795548', // brown 500

                    B2G: '#e57373', // red 300
                    BPH: '#f06292', // pink 300
                    BTV: '#ba68c8', // purple 300
                    EGM: '#9575cd', // deep purple 300
                    EWK: '#7986cb', // indigo 300
                    EXO: '#64b5f6', // blue 300
                    FSQ: '#4fc3f7', // light blue 300
                    FWD: '#4dd0e1', // cyan 300
                    HCA: '#4db6ac', // teal 300
                    HIG: '#81c784', // green 300
                    HIN: '#aed581', // light green 300
                    JME: '#dce775', // lime 300
                    L1T: '#fff176', // yellow 300
                    MUO: '#ffd54f', // amber 300
                    QCD: '#ffb74d', // orange 300
                    SMP: '#ff8a65', // deep orange 300
                    SUS: '#a1887f', // brown 300
                    TAU: '#90a4ae', // blue gray 300
                    TOP: '#e0e0e0', // gray 300
                    TRK: '#f06292', // pink 300
                    TSG: '#ffb74d', // orange 300
                };

                // credits: richard maloney 2006
                function getTintedColor(color, v) {
                    if (color.length > 6) {color = color.substring(1, color.length)}
                    var rgb = parseInt(color, 16); 
                    var r = Math.abs(((rgb >> 16) & 0xFF)+v); if (r>255) r = 255;
                    var g = Math.abs(((rgb >> 8) & 0xFF)+v); if (g>255) g = 255;
                    var b = Math.abs((rgb & 0xFF)+v); if (b>255) b = 255;
                    r = Number(r < 0 || isNaN(r)) ? 0 : ((r > 255) ? 255 : r).toString(16); 
                    if (r.length == 1) r = '0' + r;
                    g = Number(g < 0 || isNaN(g)) ? 0 : ((g > 255) ? 255 : g).toString(16); 
                    if (g.length == 1) g = '0' + g;
                    b = Number(b < 0 || isNaN(b)) ? 0 : ((b > 255) ? 255 : b).toString(16); 
                    if (b.length == 1) b = '0' + b;
                    return "#" + r + g + b;
                }

                function colors(d) {
                    var b = d.columnsXDomainAttribute;
                    if (colorMap[b] != undefined) {
                        var c = colorMap[b];
                        if (d.columnsYDomainAttribute == undefined) {
                            return c;
                        } else {
                            v = rows_color_domain.indexOf(d.columnsYDomainAttribute);
                            return getTintedColor(c, parseInt(100/rows_color_domain.length)*v);
                        }
                    }
                    return colors_stacks[b](rows_color_domain.indexOf(d.columnsYDomainAttribute));
                }

                function prepareArguments() {
                    data = scope.data|| [];
                    value = scope.value || "";
                    grouping = scope.grouping || [];
                    columns = scope.columns || "";
                    stacking = scope.stacking ? scope.stacking.slice(0) : [];
                    yScaleType = scope.yScaleType || "linear";
                    valueOperation = scope.valueOperation || 'events';
                    duration = isNaN(scope.duration) ? 1000 : scope.duration;
                    if(scope.legend){
                        margin.right=100;
                    } else {
                        margin.right=50;
                    }
                }

                function formatY(d) {
                    var l = ['G', 'M', 'k', ''];
                    var s, j = 0
                    for (var i = 1e9; i > 0; i = i / 1e3) {
                        s = d / i;
                        if (s >= 1) {
                            return s + l[j]
                        }
                        j++;
                    }
                }

                function changeWidthHeight() {
                    width = scope.userWidth || 1125;
                    height = scope.userHeight || 375;
                    width = width  - margin.left - margin.right;
                    height = height - margin.top - margin.bottom;
                    max_column_width = width/4;

                    // main X scale (used if there is no grouping)
                    x_scale = d3.scale.ordinal()
                    .rangeRoundBands([0, width]).domain(["All"]);
                    column_width = width;

                    //main Y scale
                    y_scale = d3.scale;
                    if (yScaleType=="log") {
                        y_scale = y_scale.log();
                    } else {
                        y_scale = y_scale.linear();
                    }
                    y_scale = y_scale.range([height, 0]);

                    //calculate axes
                    xAxis = d3.svg.axis()
                        .orient("bottom");

                    yAxis = d3.svg.axis()
                        .scale(y_scale).ticks(5)
                        .tickFormat(formatY)
                        .orient("left");

                    // create base SVG (and translate it to the start of plot)
                    main_svg
                        .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom));

                    if(typeof scope.responsive === 'boolean' && scope.responsive===false)
                        main_svg.attr("width", width + margin.left + margin.right)
                            .attr("height", height + margin.top + margin.bottom);
                    else
                        main_svg.attr("width", "100%")
                            .style("height", "100%"); // bugfix for webkit height miscalculcation

                    svg.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                    // translate x axis
                    svg.select(".x.axis")
                        .attr("transform", "translate(0," + height + ")");

                    // show 'no data' information
                    if(!data.length) {
                        if(!svg.selectAll(".no-data-info")[0].length) {
                            svg.append("text")
                                .attr("class", "no-data-info")
                                .attr("text-anchor", "middle")
                                .attr('font-size', 20)
                                .attr("transform", "translate(" + width/2 + "," +  height/2 + ")")
                                .text("No data");
                        }
                    } else {
                        svg.select(".no-data-info").remove();
                    }

                    scales['undefined']={};
                    scales['undefined'].rangeBand = function(){return width};
                }


                function updateDataStructure() {
                    sums = [];
                    rows_color_domain = [];
                    function prepare_stacking(input_list, stacking_level, x_attr, y_attr, start_value, info_attribute, main_group) {
                        var i = 0;
                        var ret = [];
                        if(stacking_level == stacking.length-1) { // last one
                            for(; i<rows_domains[stacking_level].length; i++) {
                                var t = {};
                                t["tooltipInfoAttribute"] = "";
                                if(valueOperation == 'events') {
                                    t[value] = d3.sum(input_list, function(d) {
                                            if(d[stacking[stacking_level]]==rows_domains[stacking_level][i])
                                                return d['total_events'];
                                            return 0;
                                        });
                                } else if(valueOperation == 'requests') {
                                    var v = '';
                                    t[value] = input_list.filter(function(d){
                                        if(d[stacking[stacking_level]]==rows_domains[stacking_level][i]) {
                                            v = d[value];
                                            return true;
                                        }
                                        return false;
                                    }).length;
                                } else if(valueOperation == 'seconds') {
                                    t[value] = d3.sum(input_list, function(d) {
                                            if(d[stacking[stacking_level]]==rows_domains[stacking_level][i])
                                                return d['total_events']*d['time_event'];
                                            return 0;
                                        });
                                }
                                var final_y_attr = y_attr + rows_domains[stacking_level][i];
                                if(rows_color_domain.indexOf(final_y_attr)<0)
                                    rows_color_domain.push(final_y_attr);
                                t["columnsXDomainAttribute"] = x_attr;
                                t["columnsYDomainAttribute"] = final_y_attr;
                                t["rowsYEndingAttribute"] = start_value+t[value];
                                if(main_group=="") {
                                    t["mainGroupAttribute"] = x_attr;
                                } else {
                                    t["mainGroupAttribute"] = main_group;
                                }
                                // data for tooltip
                                t["tooltipInfoAttribute"] += info_attribute + "\n" + stacking[stacking_level] + ": " + rows_domains[stacking_level][i] ;
                                start_value+=t[value];
                                sums.push(t[value]);
                                ret.push(t);
                            }
                            sums.push(start_value);
                        }
                        else
                            for(; rows_domains.length && i<rows_domains[stacking_level].length; i++) {
                                var stacked_data = prepare_stacking(input_list.filter(function(d){
                                    return d[stacking[stacking_level]]==rows_domains[stacking_level][i] }),
                                    stacking_level+1,
                                    x_attr,
                                    y_attr + rows_domains[stacking_level][i],
                                    start_value,
                                    info_attribute + "\n" + stacking[stacking_level] + ": " + rows_domains[stacking_level][i],
                                    main_group);
                                start_value = stacked_data[1];
                                var stacked = stacked_data[0];
                                ret = ret.concat(stacked);
                            }
                        return [ret, start_value];

                    }
                    nested = d3.nest();
                    // create domains for each group and nested structure
                    grouping.forEach(function(key){
                        var t_domain = data.reduce(function(acc, d){
                            if(acc.indexOf(d[key])<0) acc.push(d[key]);
                            return acc}, []);
                        if(scope.sort) {
                            t_domain.sort(function(a,b) {
                                if(!(isNaN(a) || isNaN(b))){
                                    a=+a;
                                    b=+b;
                                   }
                                return d3.ascending(a,b);
                            });
                        }
                        scales[key] = d3.scale.ordinal().domain(t_domain);
                        if(key==grouping[0]) {
                            scales[key].rangeRoundBands([0, width], 0.05);
                        } else {
                            scales[key].rangeRoundBands([0, scales[grouping[grouping.indexOf(key)-1]].rangeBand()])
                        }

                        nested.key(function(d){return d[key];});
                    });

                    nested.rollup(function(leaves){
                        var ret = [];
                        var filtered_leaves = [];
                        var group_representation = leaves[0];
                        var info = "";
                        for(var i = 0; i<grouping.length; i++) {
                            info += "\n" + grouping[i] + ": " + group_representation[grouping[i]];
                        }
                        for(i = 0; i<columns_domain.length && columns_domain[i]!=undefined; i++) {
                            filtered_leaves.push(
                                {
                                    info_attribute: "\n" + columns + ": " + columns_domain[i] + info,
                                    column: columns_domain[i],
                                    values: leaves.filter(function(d) {
                                        return d[columns]==columns_domain[i];
                                    })
                                });
                        }
                        if(!filtered_leaves.length) {
                            filtered_leaves = [{column: undefined, values: leaves, info_attribute: info}];
                        }
                        var main_group = "All";
                        if(grouping.length) {
                            main_group = "" + group_representation[grouping[0]];
                        } else if(columns!="") {
                            main_group = "";
                        }
                        for(i=0;i<filtered_leaves.length; i++) { // go through columns
                            var stacked_data = prepare_stacking(filtered_leaves[i].values, 0, filtered_leaves[i].column, "", 0, filtered_leaves[i].info_attribute, main_group);
                            ret = ret.concat(stacked_data[0]);
                        }
                        if(!ret.length) { //means no stacking
                            for(i=0;i<filtered_leaves.length; i++) {
                                var t = {};
                                t.columnsXDomainAttribute = filtered_leaves[i].column;
                                t.tooltipInfoAttribute = filtered_leaves[i].info_attribute;
                                if (valueOperation == 'events') {
                                    scope.$parent.$parent.setScaleAndOperation(0, 0);
                                    t[value] = d3.sum(filtered_leaves[i].values,
                                                      function(d) {
                                                          return d['total_events']
                                                      });
                                } else if (valueOperation == 'requests') {
                                    scope.$parent.$parent.setScaleAndOperation(0, 1);
                                    t[value] = filtered_leaves[i].values.length;
                                } else if (valueOperation == 'seconds') {
                                    scope.$parent.$parent.setScaleAndOperation(0, 2);
                                    // sum over product of time_event and total_events
                                    t[value] = d3.sum(filtered_leaves[i].values,
                                                      function(d) {
                                                          return d['total_events']*d['time_event']
                                                      });
                                }
                                t.rowsYEndingAttribute = t[value];
                                if(main_group=="") {
                                    t["mainGroupAttribute"] = filtered_leaves[i].column;
                                } else {
                                    t["mainGroupAttribute"] = main_group;
                                }
                                sums.push(t[value]);
                                ret.push(t);
                                rows_color_domain.push(undefined);
                            }
                        }
                        return ret;
                    });

                }

                function updateAxes() {
                    if(grouping.length) {
                        xAxis.scale(scales[grouping[0]]);
                    } else {
                        if(columns) {
                            xAxis.scale(scales[columns]);
                        } else {
                            xAxis.scale(x_scale);
                        }
                    }
                    //yAxis.tickFormat(d3.format(""));
                    yAxis.tickFormat(formatY);
                    if(yScaleType == "log" && ( columns || grouping.length ) && data.length) {
                        function prepareTicks(minimalValue, maximalTick, minimalTick) {
                            var retList = [];
                            retList.push(Math.pow(10, Math.ceil(Math.log(maximalTick)/Math.log(10))));
                            while(retList[retList.length-1]>=minimalValue) {
                                retList.push(retList[retList.length-1]/10);
                            }
                            if(retList[retList.length-1]<minimalTick) retList.pop();
                            return retList;
                        }
                        var t = sums.pop();
                        yAxis.tickValues(prepareTicks(d3.min(sums), d3.max(y_scale.ticks()), t));
                        sums.push(t);
                    }

                    svg.select(".grid.horizontal")
                        .transition()
                        .duration(duration)
                        .call(d3.svg.axis().scale(y_scale)
                            .orient("left")
                            .tickSize(-width)
                            .tickFormat("")
                            .tickValues(yAxis.tickValues())
                    );

                    // y axis title
                    if (valueOperation == 'events') {
                        axesYTitle = 'events';
                    } else if (valueOperation == 'requests') {
                        axesYTitle = 'requests';
                    } else if (valueOperation == "seconds") {
                        axesYTitle = 's';
                    }
                    if (yScaleType == 'log') {
                        axesYTitle = 'log(' + axesYTitle + ')';
                    }
                    svg.select(".y.axis")
                        .select("#ytitle")
                        .text(axesYTitle);

                    svg.select(".y.axis")
                        .transition()
                        .duration(duration)
                        .call(yAxis);

                    svg.select(".x.axis")
                       .transition()
                       .duration(duration)
                       .call(xAxis)
                        .selectAll(".x.axis .tick")
                        .call(endall, function(){
                            svg.selectAll(".x.axis .tick")
                                .filter(function(){
                                    return d3.select(this).select("title").empty()
                                })
                                .append("title");

                            svg.selectAll(".x.axis .tick title").text(function(d){
                                    var string_to_show = '';
                                    if(valueOperation == 'events') {
                                        string_to_show = 'Number of events';
                                    } else if(valueOperation == 'requests') {
                                        string_to_show = 'Number of requests';
                                    } else if(valueOperation == 'seconds') {
                                        string_to_show = 'Seconds per event';
                                    }
                                    var sum_value = d3.sum(svg.selectAll("rect.grouping" + d).data(),
                                        function(d){
                                            return d[value];
                                        });
                                    string_to_show += ": " + sum_value;
                                    return d+"\n"+string_to_show;
                                });
                        })
                        .selectAll("text")
                                .style("text-anchor", "end")
                                .style("cursor", "default") // pointer when zooming implemented?
                                .attr("dx", "-.8em")
                                .attr("dy", ".15em")
                                .attr("transform", "rotate(-45)");

                    svg.selectAll(".x.axis text")
                        .on("mouseover", function(d) {
                           svg.selectAll("rect.grouping" + d).style("fill", highlight_color);
                        })
                        .on("mouseout", function(d) {
                                svg.selectAll("rect.grouping" + d).style("fill", function(d) {return colors(d);});//return colors_stacks[d.columnsXDomainAttribute](rows_color_domain.indexOf(d.columnsYDomainAttribute));});
                        })

                }

                function updateData() {
                    nested_data = nested.entries(data);

                    if(!grouping || !grouping.length) {
                        if(columns) {
                            nested_data = [{values: nested_data, key: columns}];
                        } else {
                            nested_data = [{values: nested_data, key: "All"}];
                        }
                    }
                    if (yScaleType=="log"){
                        scope.$parent.$parent.setScaleAndOperation(1, 1);
                        sums = sums.filter(function(el) {
                            return el!=0;
                        });
                        sums.push(d3.min(sums)-d3.min(sums)/5); // for nicer formatting of data
                    } else {
                        scope.$parent.$parent.setScaleAndOperation(1, 0);
                        sums.push(0);
                    }
                }

                function updateDomains() {
                    columns_domain = data.reduce(function(acc, d) {if(acc.indexOf(d[columns])<0) acc.push(d[columns]);return acc}, []);
                    if(scope.sort) {
                        columns_domain.sort(function(a,b) {
                            if(!(isNaN(a) || isNaN(b))) {
                                a=+a;
                                b=+b;
                                return d3.ascending(a,b);
                               }
                            return 0;
                        });
                    }
                    rows_domains = [];
                    for(var i=0; i<stacking.length; i++) {
                        rows_domains.push(data.reduce(function(acc, d) {
                            if(acc.indexOf(d[stacking[i]])<0)
                                acc.push(d[stacking[i]]);
                            return acc}, []));
                    }
                }

                function updateScales() {
                    if(columns) {
                        scales[columns] = d3.scale.ordinal().domain(columns_domain).rangeRoundBands([0, scales[grouping[grouping.length-1]].rangeBand()], 0.02, 0.02);
                    } else {
                        scales[columns] = function(){return column_width/2-max_column_width/2};
                    }
                    // color
                    var color=d3.scale.category10().domain(columns_domain);
                    colors_stacks = {};
                    for(var c=0; c<columns_domain.length; c++) {
                        var column_color = d3.rgb(color(columns_domain[c]));
                        var starting_color, ending_color;
                        if(stacking.length) {
                            starting_color = column_color.darker(1.5);
                            ending_color = column_color.brighter(2)
                        } else {
                            starting_color = column_color;
                            ending_color = column_color;
                        }
                        colors_stacks[columns_domain[c]] = d3.scale.linear().range([starting_color, ending_color]).domain([0, rows_color_domain.length-1]);
                    }
                    y_scale.domain([d3.min(sums), d3.max(sums)]);
                }

                function draw() {
                    //creating grouped columns
                    svg_group=svg.selectAll(".group.lvl0")
                        .data(nested_data)
                        .attr("class",  function(d){return "group lvl0 top" + d.key;});

                    svg_group
                        .enter()
                        .append("g")
                        .attr("class",  function(d){return "group lvl0 top" + d.key;});


                    svg_group
                        .exit()
                        .selectAll("rect")
                        .transition()
                        .duration(duration)
                        .attr("width", 0)
                        .attr("height", 0)
                        .attr("y", height)
                        .call(endall, function(){
                            svg_group.exit().remove();
                        });

                    var l = 1;
                    if(grouping.length) {
                        svg_group
                            .transition()
                            .duration(duration)
                            .attr("transform", function(d){return "translate(" + scales[grouping[0]](d.key) + ",0)";});
                        column_width = scales[grouping[grouping.length-1]].rangeBand();
                        for (l=1;l<grouping.length; l++) {
                            // remove rectangles at this level, as we will have them at leaf level
                            svg_group.selectAll("rect.lvl" + l)
                                .transition()
                                .duration(duration)
                                .attr("width", 0)
                                .attr("height", 0)
                                .attr("y", height)
                                .remove();

                            // work with groups now
                            svg_group = svg_group.selectAll(".group.lvl" + l).data(function (d) { return d.values});
                            svg_group
                                .enter()
                                .append("g")
                                .attr("class", "group lvl" + l)
                                .transition()
                                .duration(duration)
                                .attr("transform", function(d){return "translate(" + scales[grouping[l]](d.key) + ",0)";});
                            svg_group
                                .exit()
                                .selectAll("rect")
                                .transition()
                                .duration(duration)
                                .attr("width", 0)
                                .attr("height", 0)
                                .attr("y", height)
                                .call(endall, function(){
                                    svg_group.exit().remove();
                                });
                        }
                    } else {
                        svg_group
                            .transition()
                            .duration(duration)
                            .attr("transform", "translate(0,0)");
                    }

                    // remove all sub-groups with all sub-rectangles (as rectangles should be only at the given level)
                    svg_group
                        .selectAll(".group.lvl"+l)
                        .selectAll("rect")
                        .transition()
                        .duration(duration)
                        .attr("width", 0)
                        .attr("height", 0)
                        .attr("y", height)
                        .call(endall, function(){
                            svg_group.selectAll(".group.lvl"+l).remove();
                        });

                    if(columns) {
                        column_width = scales[columns].rangeBand();
                    }

                    function setTitle(d) {
                        var string_to_show = '';
                        if (valueOperation == 'events') {
                            string_to_show = 'Number of events';
                        } else if (valueOperation == 'requests') {
                            string_to_show = 'Number of requests';
                        } else if (valueOperation == 'seconds') {
                            string_to_show = 'Seconds per event';
                        }
                        string_to_show += ": " + d[value];
                        if(d.tooltipInfoAttribute){
                            string_to_show += d.tooltipInfoAttribute;
                        }
                        return string_to_show;
                    }

                    var rect = svg_group.selectAll("rect.lvl"+l)
                        .data(function(d){return d.values.filter(function(d) {
                            return height-y_scale(d[value]);
                        })});

                    //update old ones
                    rect.select("title")
                        .text(setTitle);

                    //create new ones
                    rect.enter()
                        .append("rect")
                        .attr("width", 0)
                        .attr("alignment", "center")
                        .attr("y", height)
                        .attr("height",0)
                        .on("mouseover", function() {
                            this.parentNode.appendChild(this);
                            d3.select(this).style("fill", highlight_color);
                        })
                        .on("mouseout", function() {
                                d3.select(this).style("fill", function(d) {
                                        return colors(d)});
                        }).append("svg:title").text(setTitle);

                    // do something to old and new ones
                    rect
                        .attr("class", function(d){return "grouping" + d.mainGroupAttribute + " lvl"+ l + " columning" + d.columnsXDomainAttribute})
                        .transition()
                        .duration(duration)
                        .delay(function(d,i){return i/(data.length) * duration;})
                        .attr("d", function(d){return d[value]})
                        .style("fill", function(d) {return colors(d)})
                        .attr("width", function(){if(column_width> max_column_width) return max_column_width; else return column_width})
                        .attr("y", function(d) { if(d.rowsYEndingAttribute==0) return 0;
                            return y_scale(d.rowsYEndingAttribute);
                        })
                        .attr("height",  function(d) {if(d[value] == 0) return 0;
                            return height-y_scale(d[value])
                        })
                        .attr("x", function(d){
                            if(column_width> max_column_width || columns)
                                return scales[columns](d.columnsXDomainAttribute);
                            else
                                return 0
                        });

                    //remove not-important ones
                    rect.exit()
                        .transition()
                        .duration(duration)
                        .attr("height", 0)
                        .attr("y", height)
                        .attr("width", 0)
                        .remove();

                    // draw legend
                    if (scope.legend && columns_domain[0] != undefined) {
                        var l = svg.select('g.legend');
                        if (l.empty()) {
                            svg.append('g').attr('class', 'legend');
                        } else {
                            l.selectAll('*').remove();
                        }

                        l = svg.select(".legend")
                            .attr("transform", "translate(" + width + ",0)")
                            .attr("width", margin.right)
                            .attr("height", columns_domain.length * 24)
                            .selectAll("g")
                            .data(columns_domain);

                        var new_leg = l
                            .enter()
                            .append("g")
                            .attr("transform", function(d, i) {
                                return "translate(0, " + i * 24 + ")";
                            });

                        new_leg.append("rect")
                            .attr("width", 20)
                            .attr("height", 20)
                            .style("fill", function(d) {
                                if (colorMap[d] != undefined) {
                                    return colorMap[d];
                                } else {
                                    return colors_stacks[d](0);
                                }
                            });

                        new_leg.append("text")
                            .attr("x", 24)
                            .attr("y", 10)
                            .attr("dy", ".35em")
                            .style("cursor", "default");

                        new_leg.append("title");

                        l.select("rect")
                            .transition()
                            .duration(duration)
                            .style("fill", function(d) {
                                if (colorMap[d] != undefined) {
                                    return colorMap[d];
                                } else {
                                    return colors_stacks[d](0);
                                }
                            });

                        l.select("text")
                            .text(function(d) {
                                return d;
                            });

                        l.select("title")
                            .text(function(d) {
                                var string_to_show = '';
                                if (valueOperation == 'events') {
                                    string_to_show = 'Number of events';
                                } else if (valueOperation == 'requests') {
                                    string_to_show = 'Number of requests';
                                } else if (valueOperation == 'seconds') {
                                    string_to_show = 'Seconds per event';
                                }
                                var sum_value = d3.sum(svg.selectAll("rect.columning" + d).data(),
                                    function(d) {
                                        return d[value];
                                    });
                                string_to_show += ": " + sum_value;
                                return d + "\n" + string_to_show;
                            });

                        l.on("mouseover", function(d) {
                                svg.selectAll("rect.columning" + d).style("fill", highlight_color);
                            })
                            .on("mouseout", function(d) {
                                svg.selectAll("rect.columning" + d).style("fill", function(d) {
                                    return colors(d)
                                });
                            })
                    } else {
                        svg.select(".legend").remove();
                    }
                }

                function redraw() {
                    prepareArguments();
                    changeWidthHeight();
                    updateDataStructure();
                    updateDomains();
                    updateData();
                    updateScales();
                    draw();
                    updateAxes();
                }

                scope.$watch('data', function(dat) {
                    redraw();
                });

                scope.optionsChange = function() {
                    return 'stacking + columns + grouping + yScaleType + valueOperation';
                };

                scope.$watch(scope.optionsChange(), function(dat) {
                    redraw();
                });
            }
        }

    })
    .directive('mcmCustomizableChart', function($compile) {
        return {
            restrict: 'E',
            scope: {
                chartType:'=', // html tag
                chartData: '=', // data to transfer to chart (as data='chartData')
                title: '@chartTitle', // title of customizable chart (above everything)
                selections: '=?', // what can you select from when it comes to single and multi values
                options: '=?', // dictionary with all the options for selections (value can be a string (single value) or list (multiple values possible))
                radio: '=?', // dictionary of radio-button based selections for finer tuning (value is a list, first element is the default one)
                settings: '=?' // dictionary of other settings for the chart (not customizable by UI)
            },
            link: function(scope, element, attrs) {
                scope.selections = scope.selections || [];
                scope.radio = scope.radio || {};
                scope.options = scope.options || {};
                scope.settings = scope.settings || {};

                scope.removeOption = function(optionName, optionValue) {
                    scope.$parent.setURL('selections', optionValue);
                    if(scope.options[optionName] instanceof Array) {
                        var index = scope.options[optionName].indexOf(optionValue);
                        if(index > -1) {
                            scope.options[optionName].splice(index, 1);
                        }
                    } else {
                        scope.options[optionName] = "";
                    }
                    scope.$apply();
                };

                scope.addOption = function(optionName, optionValue, optionIndex) {
                    scope.$parent.setURL(optionName, optionValue);
                    if(scope.options[optionName] instanceof Array) {
                        scope.options[optionName].splice(optionIndex-1, 0, optionValue);
                    } else {
                        scope.options[optionName] = optionValue;
                    }
                    scope.$apply();
                };

                var innerHtml = "<style>.nav.dnd {margin-bottom: 0;}</style>";
                //innerHtml += "<div class='row' align='middle'><h4>{{title}}</h4></div>";
                innerHtml += "<div class='row'><div class='col-lg-9 col-md-12 col-sm-12' style='margin-bottom: 3px'><span class='col-lg-2 col-md-2 col-sm-2 nav-header text-muted'>selections</span>";

                innerHtml += "<ul id='possible-selections' class='nav nav-pills dnd col-lg-10 col-md-10 col-sm-10 inline' style='min-height:22px'>";
                innerHtml += "<li class='btn btn-default btn-xs text-uppercase' ng-repeat='value in selections'>{{value}}</li>";
                innerHtml += "</ul></div>";
                // options for drag and drop
                for(var key in scope.options) {
                    var value = scope.options[key];
                    if(value instanceof Array) {
                        innerHtml += "<div class='col-lg-6 col-md-12 col-sm-12'><span class='col-lg-3 col-md-2 col-sm-2 nav-header' style='margin-bottom: 3px'>"+key+"</span>";
                        innerHtml += "<ul id='"+key+"' class='nav nav-pills dnd col-lg-9 col-md-10 col-sm-10 inline alert-info' style='min-height:23px; margin-top:1px'>";
                        for(var i=0;i<value.length;i++) {
                            innerHtml+="<li class='btn btn-default btn-xs text-uppercase'>"+value[i]+"</li>";
                        }
                        innerHtml+="</ul></div>";
                    } else {
                        innerHtml += "<div class='col-lg-6 col-md-12 col-sm-12'><span class='col-lg-3 col-md-2 col-sm-2 nav-header' style='margin-bottom: 3px'>"+key+"</span>";
                        innerHtml+="<ul id='"+key+"' class='nav nav-pills dnd single col-lg-9 col-md-10 col-sm-10 inline alert-info' style='min-height:23px; margin-top:1px'>";
                        if(value!="") {
                            innerHtml+="<li class='btn btn-default btn-xs text-uppercase'>" + value + "</li>";
                        }
                        innerHtml+="</ul></div>";
                    }
                }
                innerHtml +="</div>";
                innerHtml += "<div class='row' >";
                // radio buttons
                scope.radiovalue = {};
                for(key in scope.radio) {

                    innerHtml += "<div class='col-lg-6 col-md-6 col-sm-12 spacing-sm' style='margin-top:3px;'>";
                    innerHtml += "<span class='col-lg-3 col-md-4 col-sm-2 nav-header'>" + key + "</span>";

                    innerHtml += "<ul class='nav nav-pills inline col-lg-9 col-md-8 col-sm-10'>";
                    scope.radiovalue[key] = scope.radio[key][0];
                    innerHtml += "<li>";

                    innerHtml += "<div class='btn-group'>";
                    innerHtml += "<button ng-repeat='value in radio." + key + "' type='button' class='btn btn-primary btn-xs text-uppercase' ng-model='radiovalue." + key + "' btn-radio='value'>{{value}}</button>";
                    innerHtml += "</div>";
//                    innerHtml +="<select style='height:24px' class='btn btn-defualt btn-xs col-lg-2 col-md-2' ng-model='radio"+key+"' ng-options='v for v in radio[\"" + key + "\"]'></select>";
                    innerHtml +="</li>";
                    innerHtml +="</ul></div>";

                }
                innerHtml +="</div>";


                innerHtml += "<" + scope.chartType + " data='chartData' ";
                // concatenate radio and options
                for(key in scope.options) {
                    innerHtml += key + "='options[\""+key+"\"]' ";
                }
                for(key in scope.settings) {
                    innerHtml += key + "='settings[\""+key+"\"]' ";
                }
                for(key in scope.radio) {
                    innerHtml += key + "='radiovalue[\""+key+"\"]' ";
                }
                innerHtml += "></" + scope.chartType + ">";

                var chart = $compile(innerHtml)(scope);
                element.append(chart);

                var group_rand = Math.random(); // so it's not possible to move to other groups

                $("ul.nav.dnd", element).sortable({
                    group: group_rand,
                    nested: false,
                    vertical: false,
                    exclude: 'nav-header',
                    title: 'nav-header',
                    pullPlaceholder:false,
                    isValidTarget: function($item, container) {
                        return !($(container.el[0]).hasClass("single") && container.items.length > 0);
                    },
                    onDrop: function($item, container, _super) {
                        if(container.el[0].id!='possible-selections') {
                            scope.addOption(container.el[0].id, $item[0].textContent, $(container.el[0].children).index($item[0]));
                        }
                        _super($item, container);
                        },
                            onDragStart: function($item, container, _super) {
                        if(container.el[0].id!='possible-selections') {
                            scope.removeOption(container.el[0].id, $item[0].textContent);
                        }
                        _super($item, container);
                        }
                });

            }
        }
    })
.directive("multiplePieCharts", function($compile) {
    return {
        restrict: 'EA',
        scope: {
            data: "=",
            compactTerms: "=?", // term not existing in full-terms list will hold compacted sum
            fullTerms: "=?", // list of terms for full view of piechart
            nestBy: "=?", // how to divide data
            sumBy: "=?", // by what to sum data in leaves
            showTable: "=?", // should the table be shown below piecharts (by default true)
            tableTitle: "@", // title of the left column in table
            showUpcoming: '=',
            colorDomain: "=?" // order of colors (colors are taken as 10 basic colors from d3.js)
        },
        link: function(scope, element, attrs) {
            var nested = d3.nest();
            var nestBy = scope.nestBy || [];
            var sumBy = scope.sumBy || [];
            var fullTerms = scope.fullTerms || [];
            var compactTerms = scope.compactTerms || [];
            var foundNonExistant = false;
            for (var i = 0; i < compactTerms.length; i++) {
                var temp = compactTerms[i];
                if (fullTerms.indexOf(temp) == -1) {
                    compactTerms.splice(i, 1);
                    compactTerms.push(temp);
                    foundNonExistant = true;
                    break;
                }
            }

            if (!foundNonExistant) {
                compactTerms.push('rest')
            }

            if (typeof scope.showTable === 'boolean' && scope.showTable === false) {
                var showTable = false;
            } else {
                var showTable = true;
            }

            var dataTermsFull = {};
            for (i = 0; i < fullTerms.length; i++) {
                dataTermsFull[fullTerms[i]] = i;
            }

            var dataTermsCompact = {};
            for (i = 0; i < compactTerms.length; i++) {
                dataTermsCompact[compactTerms[i]] = i;
            }

            nestBy.forEach(function(key) {
                nested.key(function(d) {
                    return d[key]
                });
            })
            nested.rollup(function(leaves) {
                return d3.sum(leaves, function(d) {
                    return d[sumBy];
                })
            });
            scope.$watch('data', function(dat) {
                scope.piechart_data = {};
                scope.piechart_data_full = {};
                scope.current_data = {};
                dat = dat || []
                var nested_data = nested.entries(dat);
                for (var i = 0; i < nested_data.length; i++) {
                    var key = nested_data[i].key;

                    var piechart_data_full_terms = [];
                    for (var t = 0; t < fullTerms.length; t++) {
                        piechart_data_full_terms.push({
                            term: fullTerms[t],
                            count: 0
                        });
                    }
                    var piechart_data_terms = [];
                    for (t = 0; t < compactTerms.length; t++) {
                        piechart_data_terms.push({
                            term: compactTerms[t],
                            count: 0
                        });
                    }

                    var piechart_data = {
                        terms: piechart_data_terms,
                        status: {
                            key: key,
                            state: 0
                        }
                    };

                    var piechart_data_full = {
                        terms: piechart_data_full_terms,
                        status: {
                            key: key,
                            state: 1
                        }
                    };

                    for (var j = 0; j < nested_data[i].values.length; j++) {
                        if (nested_data[i].values[j].key in dataTermsFull) {
                            piechart_data_full.terms[dataTermsFull[nested_data[i].values[j].key]].count = nested_data[i].values[j].values;
                            if (nested_data[i].values[j].key in dataTermsCompact) {
                                piechart_data.terms[dataTermsCompact[nested_data[i].values[j].key]].count = nested_data[i].values[j].values;
                            } else {
                                piechart_data.terms[compactTerms.length - 1].count += nested_data[i].values[j].values;
                            }
                        }
                    }
                    if (key in scope.current_data) {
                        if (scope.current_data[key].data.status) {
                            scope.current_data[key].data = piechart_data_full;
                        } else {
                            scope.current_data[key].data = piechart_data;
                        }
                    } else {
                        scope.current_data[key] = {};
                        scope.current_data[key].data = piechart_data;
                    }
                    scope.piechart_data[key] = piechart_data;
                    scope.piechart_data_full[key] = piechart_data_full;
                }
            });

            scope.changeChart = function(name, term, state) {
                if (state.state) {
                    scope.current_data[state.key].data = scope.piechart_data[state.key];
                } else {
                    scope.current_data[state.key].data = scope.piechart_data_full[state.key];
                }
            };

            // domain for colors
            scope.domain = scope.colorDomain || _.union(fullTerms, compactTerms);

            var innerHtml = '<mcm-donut-chart ng-repeat="(key, terms) in current_data" data="terms.data" outer-radius="100" inner-radius="40" inner-title="{{key}}" on-click-title="changeChart" domain="domain"></mcm-donut-chart>';
            if (showTable) {
                innerHtml += '<table class="table table-bordered table-striped table-condensed col-lg-12 col-md-12 col-sm-12"><thead><tr><th class="text-center">{{tableTitle}}</th><th class="text-center" ng-repeat="term in fullTerms">{{term}}</th></tr></thead><tbody><tr ng-repeat="(key, terms) in piechart_data_full"><td class="text-left">{{key}}</td><td class="text-right" ng-show="element.term !== \'upcoming\' || showUpcoming" ng-repeat="element in terms.terms">{{element.count}}</td></tr></tbody></table>';
            }
            element.append($compile(innerHtml)(scope));
        }
    }
});