/**
 * @name performanceHistorgram.directive
 * @type directive
 * @description Directive controlling histogram in performance statistics
 */
.directive('performanceHistogram', [function () {
    return {
        restrict: 'E',
        scope: {
            data: '=',
            scale: '=',
            numberOfBins: '=',
            binSelectedCallback: '=',
            bigNumberFormatter: '=',
            bigNumberFormatterLog: '='
        },
        link: function(scope, element, compile, http) {
            // graph configuration
            config = {
                customWidth: 1160,
                customHeight: 620,
                margin: {
                    top: 40,
                    right: 80,
                    bottom: 170,
                    left: 80
                }
            };
            scope.minDiff = 0;
            scope.maxDiff = 0;
            // General attributes
            var width = config.customWidth - config.margin.left - config.margin.right;
            var height = config.customHeight - config.margin.top - config.margin.bottom;
            // add main svg
            svg = d3.select(element[0])
                    .append('svg:svg')
                    .attr("viewBox", "0 -20 " + config.customWidth + " " + config.customHeight)
                    .attr("xmlns", "http://www.w3.org/2000/svg")
                    .append("svg:g")
                    .attr("transform", "translate(" + config.margin.left + "," + config.margin.top + ")")
                    .attr('style', 'fill: none');

            svg.append('defs')
               .append('pattern')
               .attr('id', 'diagonal-stripes')
               .attr('patternUnits', 'userSpaceOnUse')
               .attr('patternTransform', 'rotate(45)')
               .attr('width', 20)
               .attr('height', 20)
               .append('line')
               .attr('x1', 0)
               .attr('y1', 10)
               .attr('x2', 20)
               .attr('y2', 10)
               .attr('stroke', '#bdbdbd')
               .attr('stroke-width', 8);

            function formatTimestamp(number) {
                return msToDate(number * scope.range + scope.minDiff)
            }

            function msToDate(ms) {
                var days = Math.floor(ms / 86400)
                var hours = Math.floor((ms - (days * 86400)) / 3600)
                var minutes = Math.round((ms - (days * 86400 + hours * 3600)) / 60)
                if (days == 0 && hours == 0 && minutes == 0) {
                    return Math.round(ms / 1000) + 's'
                }
                var result = ''
                if (days > 0) {
                    result += days + 'd '
                }
                if (hours > 0) {
                    result += hours + 'h '
                }
                if (minutes > 0) {
                    result += minutes + 'min'
                }
                return result
            }

            // axes
            var x = d3.scaleLinear().range([0, width]);
            var xAxis = d3.axisBottom(x).ticks(10).tickFormat(formatTimestamp);
            var gx = svg.append("svg:g")
                .attr("class", "x axis minorx")
                .attr('fill', '#666')
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis);

            var y = d3.scaleLinear().range([height, 0]).domain([0, 10]);
            var yAxis = d3.axisLeft(y).ticks(5).tickFormat(scope.bigNumberFormatter);
            var gy = svg.append("svg:g")
                .attr("class", "y axis minory")
                .attr('fill', '#666')
                .call(yAxis)

            var prepareData = function(data) {
                scope.minDiff = d3.min(data, function(d) { return d.diff; })
                scope.maxDiff = d3.max(data, function(d) { return d.diff; })
                scope.range = scope.maxDiff - scope.minDiff
                var bins = Math.min(data.length, scope.numberOfBins)
                var binWidth = scope.range / bins;
                var fullBins = []
                for (var i = 0; i < bins; i++) {
                    fullBins.push({x0: i * 1 / bins, x1: (i + 1) * 1 / bins, values: []})
                }
                for (var i = 0; i < data.length; i++) {
                    var binNo = 0;
                    if (binWidth != 0) {
                        binNo = Math.min(Math.floor((data[i].diff - scope.minDiff) / binWidth), bins - 1)
                    }
                    data[i].niceDiff = msToDate(data[i].diff)
                    fullBins[binNo].values.push(data[i])
                }
                scope.selectedBin = -1;
                scope.binSelectedCallback([])
                xAxis.ticks(Math.min(10, bins))
                if (scope.scale === 'log') {
                    y = d3.scaleLog()
                    yAxis = yAxis.tickFormat(scope.bigNumberFormatterLog)
                } else {
                    y = d3.scaleLinear()
                    yAxis = yAxis.tickFormat(scope.bigNumberFormatter)
                }
                y = y.domain([0.1, d3.max(fullBins, function(d) { return d.values.length; }) + 1]).range([height, 0]);
                yAxis.scale(y);
                svg.selectAll("rect.bar").remove()
                svg.selectAll("text.bar-size-label").remove()
                svg.selectAll(".selected-bar").remove()
                svg.selectAll("g .x.axis").call(xAxis);
                svg.selectAll("g .y.axis").call(yAxis);
                svg.select(".x.axis")
                   .selectAll('text')
                   .style("font-size","14px");
                svg.select(".y.axis")
                   .selectAll('text')
                   .style("font-size","14px");

                var rect = svg.selectAll("rect")
                              .data(fullBins)
                              .enter()

                rect.append("rect")
                    .attr("fill", "#2196f3")
                    .attr("class", "bar")
                    .attr("x", 1)
                    .attr("transform", function(d) {
                        return "translate(" + x(d.x0) + "," + y(Math.max(0.001, d.values.length)) + ")";
                    })
                    .attr("width", function(d) { return Math.max(0, x(d.x1) - x(d.x0) - 1); })
                    .attr("height", function(d) { return Math.max(0, height - y(Math.max(0.001, d.values.length))); })
                    .on("mouseover", function() {
                        d3.select(this).style("fill", '#bdbdbd');
                    })
                    .on('mousedown',function(d) {
                        d3.selectAll(".selected-bar").remove()
                        var selectedRect = rect.append("rect")
                                               .attr("class", "selected-bar")
                                               .attr("transform", "translate(" + x(d.x0) + "," + y(Math.max(0.001, d.values.length)) + ")")
                                               .attr("width", Math.max(0, x(d.x1) - x(d.x0) - 1))
                                               .attr("height", Math.max(0, height - y(Math.max(0.001, d.values.length))))
                                               .style("fill", "url(#diagonal-stripes)")
                        selectedRect.on('mousedown',function(d) {
                            d3.selectAll(".selected-bar").remove()
                            scope.binSelectedCallback([]);
                        })
                        scope.binSelectedCallback(d.values);
                    })
                    .on("mouseout", function() {
                        d3.select(this).style("fill", "#2196f3");
                    })

                rect.append('text')
                    .attr('dy', '.75em')
                    .attr('text-anchor', 'middle')
                    .attr('class', 'bar-size-label')
                    .attr('y', function(d) { return y(Math.max(0.001, d.values.length)) - 16; })
                    .attr('x', function(d) { return x(d.x1) - (x(d.x1) - x(d.x0)) / 2 ; })
                    .style('fill', '#333')
                    .text(function (d) {
                        return d.values.length ? d.values.length : '';
                    });

                svg.selectAll(".x.axis .tick>text")
                   .style("text-anchor","center")
                   .attr("transform", "rotate(-20) translate(0, 15)")
                   .style("font-weight", "lighter")
            };

            scope.$watch('data', function(data) {
                if (data !== undefined && data.length) {
                    prepareData(data);
                }
            });
        }
    };
}])