/**
 * @name eventDrop.directive
 * @type directive
 * @description Shows graphical representation of campaign requests' liftime phases
 */
.directive('eventDrop', function () {
    return {
        restrict: 'AE',
        scope: {
            chartData: '='
        },
        link: function (scope, element) {
            var currentMin, currentMax, graphBody, data;
            var config = {
                definedColors: {
                    created: '#ffd54f',
                    validation: '#795548',
                    approved: '#aed581',
                    submitted: '#9575cd',
                    done: '#4fc3f7'
                },
                definedYOffset: {
                    created: 15,
                    validation: 55,
                    approved: 95,
                    submitted: 135,
                    done: 175
                },
                margin: {
                    top: 40,
                    left: 40,
                    bottom: 20,
                    right: 20
                },
                pointsOpacity: 0.2,
                height: 160,
                width: 1170,
                axisLineColor: '#9e9e9e',
            };

            var zoom = d3.behavior.zoom()
                .on("zoom", onZoom);

            var dateFormat = d3.time.format("%Y-%m-%d-%H-%M");
            var getYOffset = function (d) {
                return config.definedYOffset[d.name];
            };
            var getDate = function (d) {
                return dateFormat.parse(d.date);
            };
            var getColor = function (d) {
                return config.definedColors[d.name];
            };
            var graphWidth = config.width - config.margin.right - config.margin.left - 40;
            var graphHeight = config.height + config.margin.top + config.margin.bottom;

            // Start to draw
            var svg = d3.select(element[0])
                .append('svg:svg')
                .attr('viewBox', '0 -20 ' + (graphWidth) + ' ' + (graphHeight * 1.5))
                .attr('width', '100%')
                .attr('height', '100%')
                .append('svg:g')
                .attr('transform', 'translate(' + (config.margin.left + 40) + ',' + config.margin
                    .top + ')')
                .attr('style', 'fill: none');

            // Croping graph
            var defs = svg.append('defs');
            var clipPath = defs.append('svg:clipPath')
                .attr('id', 'clip')
                .append('svg:rect')
                .attr('id', 'clip-rect')
                .attr('x', '0')
                .attr('y', '0')
                .attr('transform', 'translate(-10, 0)')
                .attr('width', graphWidth)
                .attr('height', graphHeight);

            // x Axis
            var x = d3.time.scale();
            var xAxis = d3.svg.axis().scale(x).ticks(4).tickSubdivide(1).orient('top');
            var xAxisG = svg.append('g')
                .classed('x axis', true)
                .attr('fill', config.axisLineColor)
                .attr('transform', 'translate(' + config.margin.left + ', ' + (config.margin.top -
                    40) + ')')
                .call(xAxis);

            // y Axis
            var yLabelCount;
            var yLabels;
            var resetLabelCount = function () {
                yLabelCount = {
                    created: 0,
                    validation: 0,
                    approved: 0,
                    submitted: 0,
                    done: 0
                };
            };
            var updateLabels = function () {
                resetLabelCount();
                var xDomain = x.domain();
                data.forEach(function (event, index) {
                    if (dateFormat.parse(event.date) >= xDomain[0] &&
                        dateFormat.parse(event.date) <= xDomain[1]) {
                        yLabelCount[event.name] += 1;
                    }
                });
                yLabels = [];
                for (var k in yLabelCount) {
                    if (yLabelCount.hasOwnProperty(k)) {
                        yLabels.push(k + ' (' + yLabelCount[k] + ')');
                    }
                }
            };

            var y = d3.scale.ordinal();
            var yAxis = d3.svg.axis().scale(y).orient('left');
            var yAxisG = svg.append('svg:g')
                .attr('class', 'y axis minory')
                .attr('fill', config.axisLineColor)
                .attr('transform', 'translate(' + (config.margin.left - 10) + ', ' + config.margin
                    .top + ')')
                .call(yAxis);

            function redraw() {
                svg.select('.graph-body').remove();
                svg.select('.graph-zoom').remove();
                svg.selectAll('.point').remove();

                svg.append('rect')
                    .classed('graph-zoom', true)
                    .attr('transform', 'translate(' + config.margin.left + ', 0)')
                    .style('cursor', 'move')
                    .style('fill', 'none')
                    .style('pointer-events', 'all')
                    .attr('class', 'pane')
                    .attr('width', graphWidth)
                    .attr('height', graphHeight)
                    .call(zoom);
                graphBody = svg.append('g')
                    .classed('graph-body', true)
                    .attr('clip-path', 'url(#clip)')
                    .attr('transform', 'translate(' + config.margin.left + ', ' + (config.margin.top -
                        15) + ')');

                currentMin = d3.min(data, function (d) {
                    return d.date;
                });
                currentMax = d3.max(data, function (d) {
                    return d.date;
                });

                x.domain([dateFormat.parse(currentMin), dateFormat.parse(currentMax)])
                    .range([0, graphWidth - config.margin.left - 90]);
                xAxis.scale(x);
                xAxisG.transition().duration(500)
                    .ease("linear").call(xAxis);
                zoom.x(x);

                svg.select('.y-tick').remove();
                updateLabels();
                y.domain(yLabels).rangePoints([0, config.height]);
                yAxis.scale(y);
                yAxisG.call(yAxis);
                yAxisG.append('line')
                    .attr('fill', 'none')
                    .classed('y-tick', true)
                    .attr('x1', 0)
                    .attr('x2', 0 + graphWidth - 100)
                    .attr('transform', 'translate(0,-40)');

                graphBody.selectAll('circle').data(data).enter()
                    .append('svg:circle')
                    .attr('r', 4)
                    .attr('id', 'point')
                    .attr('cx', function (d) {
                        return x(getDate(d));
                    })
                    .attr('cy', function (d) {
                        return getYOffset(d);
                    })
                    .style('opacity', config.pointsOpacity)
                    .style('fill', function (d) {
                        return getColor(d);
                    })
                    .append('title')
                    .text(function (d) {
                        return d.prepid;
                    });

                svg.selectAll('.axis path').style('stroke', '#777777').style('fill', 'none');
                svg.selectAll('.x line').style('stroke', '#777777').style('fill', 'none');
            }

            // Zoom
            function onZoom() {
                xAxisG.call(xAxis);
                updateLabels();
                y.domain(yLabels).rangePoints([0, config.height]);
                yAxis.scale(y);
                yAxisG.call(yAxis);
                svg.selectAll('circle').attr('cx', function (d) {
                    return x(getDate(d));
                });
            }

            scope.$watch('chartData', function (d) {
                if (d === undefined) return null;
                data = [];
                if (d.length) {
                    d.forEach(function (e, i) {
                        var history = e.history;
                        if (Object.keys(history)) {
                            Object.keys(history).forEach(function (h, j) {
                                var tmp = {};
                                tmp.name = h;
                                tmp.date = history[h];
                                tmp.prepid = e.prepid;
                                data.push(tmp);
                            });
                        }
                    });
                    redraw();
                }
            });
        }
    };
})