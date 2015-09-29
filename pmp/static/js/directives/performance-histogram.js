
.directive('performanceHistogram', ['$compile', function($compile) {
        return {
            restrict: 'E',
            scope: {
                chartData: '=',
                chartDataExtended: '=',
                linearScale: '=',
                numberOfBins: '='
            },
            link: function(scope, element, attrs) {
                var dataStats = [];
                var formatCount = d3.format(",.0f");
                var margin = {top: 10, right: 40, bottom: 80, left: 40};
                var width = 1170 - margin.left - margin.right;
                var height = 300 - margin.top - margin.bottom;
                var data, bar, cMax;
                    
                var x = d3.scale.linear()
                    .domain([0, 1])
                    .range([0, width]);
                
                var xAxis = d3.svg.axis()
                    .scale(x)
                    .orient('bottom')
                    .tickFormat(formatXAxis);



                var y = d3.scale.log().clamp(true).range([height, 0]).nice();

                var yAxis = d3.svg.axis()
                    .scale(y);
                
                var svg = d3.select(element[0])
                    .append('svg:svg')
                    .attr('viewBox', '0 -20 ' + (width+margin.left+margin.right)
                          + ' ' + (height+margin.top+margin.bottom))
                    .attr('width', '100%')
                    .attr('height', '100%')
                    .append('svg:g')
                    .attr('transform', 'translate(' + (margin.left) + ','
                          + margin.top + ')')
                    .attr('style', 'fill: none');

                var gx = svg.append("g")
                    .attr("class", "x axis")
                    .attr('style', 'fill: black')
                    .attr("transform", "translate(0," + (height) + ")")
                    .call(xAxis);
                
                var inputChange = function() {
                    dataStats = [];
                    if (scope.chartData == undefined) {
                        return null;
                    }
                    mMin = d3.min(scope.chartData, function(d) { return d;});
                    mMax = d3.max(scope.chartData, function(d) { return d;});
                    for(var a=0; a<scope.chartData.length; a++) {
                        var val = (scope.chartData[a]-mMin)/(mMax-mMin);
                        dataStats.push(val);
                    }
                    
                    //if (dataStats.length){
                        updateHistogram();
                    //}
                }

                var updateHistogram = function() {
                    scope.numberOfBins = scope.numberOfBins || 10;

                    var data = d3.layout.histogram()
                    .bins(x.ticks(scope.numberOfBins))(dataStats);

                    cMax = d3.max(data, function(d) { return d.y; });

                    if (scope.linearScale) {
                        y = d3.scale.linear().range([height, 0]).domain([0,cMax]);
                        yAxis.scale(y);
                    } else {
                        y = d3.scale.log().range([height, 0]).domain([1, cMax]);
                        yAxis.scale(y);
                    }

                    svg.selectAll('.x path').style('stroke', '#777777').style('fill', 'none');
                    svg.selectAll('.x line').style('stroke', '#777777').style('fill', 'none');

                    bar = svg.selectAll('.bar')
                    .data(data, function(d) { return d; });

                    bar.enter().append('g')
                    .attr('class', 'bar')
                    .attr('transform', function(d) { return 'translate(' + x(d.x) + ','+height+')';})
                    .transition()
                    .duration(1000)
                    .attr('transform', function(d) { if(isNaN(y(d.y))){
                                return 'translate(' + x(d.x) + ',0)'; }
                            return 'translate(' + x(d.x) + ',' + y(d.y) + ')'; });
                    
                    // append columns
                    bar.append('rect')
                    .attr('class', 'update')
                    .attr('cursor', 'pointer')
                    .attr('data-clipboard-text', function(data) {
                            var toCopy = [];
                            var min = d3.min(data, function(d) {return d;})*(mMax-mMin)+mMin;
                            var max = d3.max(data, function(d) {return d;})*(mMax-mMin)+mMin;
                            for (var i = 0; i < scope.chartDataExtended.length; i++) {
                                var val = scope.chartDataExtended[i].value;
                                if (val >= min && val <= max) {
                                    toCopy.push(scope.chartDataExtended[i].id);
                                }
                            }
                            new ZeroClipboard(this, {moviePath:'lib/zeroclipboard/ZeroClipboard.swf'});
                            return toCopy.join(', ');
                            })
                    .attr('height', function(d) { if(isNaN(y(d.y))){ return 0} return height-y(d.y)})
                    .attr('width', x(data[0].dx) - 1)
                    .attr('x', 1)
                    .style('shape-rendering', 'optimizeSpeed')
                    .style('fill', '#263238')
                    .on('mouseover', function(d) { d3.select(this).style('fill', '#b0bec5'); })
                    .on('mouseout', function(d) { d3.select(this).style('fill', '#263238'); })
                    .on('click', function(data) {
                            scope.$parent.showPopUp('success', 'List of requests copied'); });

                    bar.selectAll('.bar')
                    .transition()
                    .duration(1000)
                    .attr('transform', function(d) { return 'translate(' + x(d.x) + ','
                                + y(d.y) + ')'; });

                    bar.append('text')
                    .attr('dy', '.75em')
                    .attr('y', 6)
                    .attr('x', x(data[0].dx) / 2)
                    .attr('text-anchor', 'middle')
                    .style('fill', '#eeeeee')
                    .text(function(d) { return formatCount(d.y); });

                    bar.exit()
                    .attr('class', 'update')
                    .transition()
                    .duration(1500)
                    .attr('y', 60)
                    .style('fill-opacity', 1e-6)
                    .remove();

                    xAxis.tickFormat(formatXAxis);
                    gx.transition().duration(200).ease("linear").call(xAxis);
                }

                var formatXAxis = function(i) {
                    if (i == 0.1) {
                        return '10% of range';
                    }
                    if (i == 1.0) {
                        return '100%';   
                    }
                    return '';
                }
                
                var changed = function() {
                    if (scope.chartData != undefined) {
                        updateHistogram();
                    }
                }
                svg.selectAll('.axis path').style('fill', 'none');
                scope.$watch('chartData', function(d) {inputChange()});
                scope.$watch('numberOfBins', function(d) {changed()});
                scope.$watch('linearScale', function(d) {dataStats = [];changed();inputChange();});
            }
        }
    }])