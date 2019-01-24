/**
 * @name columnChart.directive
 * @type directive
 * @description Builds column chart used in present statistics
 */
/*jslint bitwise: true */
.directive('columnChart', [function() {
    return {
        restrict: 'E',
        scope: {
            data: '=',
            mode: '=',
            scale: '=',
            groupBy: '=',
            colorBy: '=',
            stackBy: '=',
            humanReadableNumbers: '=',
            binSelectedCallback: '='
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
            scope.dataCopy = []
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

            function formatBigNumbers(number) {
                if (number < 1) {
                    return ''
                }
                if (scope.scale === 'log' && Math.log10(number) % 1 !== 0) {
                    return ''
                }
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
            var x = d3.scaleLinear().range([0, width]);
            var xAxis = d3.axisBottom(x).ticks(10);
            var gx = svg.append("svg:g")
                .attr("class", "x axis minorx")
                .attr('fill', '#666')
                .attr("transform", "translate(0," + (height) + ")")
                .call(xAxis);

            var y = d3.scaleLinear().range([height, 0]).domain([0, 100]);
            var yAxis = d3.axisLeft(y).ticks(5).tickFormat(formatBigNumbers);
            var gy = svg.append("svg:g")
                .attr("class", "y axis minory")
                .attr('fill', '#666')
                .call(yAxis)

            var colorMap = {
                approved: '#4caf50', // green 500
                defined: '#9c27b0', // purple 500
                done: '#2196f3', // blue 500
                new: '#f44336', // red 500
                submitted: '#ff9800', // orange 500 
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

                YES: '#81c784',
                NO: '#f06292'
            };

            /*
             * Used for generating shaded color for stacking
             * @color - original color
             * @v - jump
             * Credits: Richard Maloney 2006
             */
            function getTintedColor(color, v) {
                if (color.length > 6) {
                    color = color.substring(1, color.length);
                }
                var rgb = parseInt(color, 16);
                var r = Math.abs(((rgb >> 16) & 0xFF) + v);
                if (r > 255) r = 255;
                var g = Math.abs(((rgb >> 8) & 0xFF) + v);
                if (g > 255) g = 255;
                var b = Math.abs((rgb & 0xFF) + v);
                if (b > 255) b = 255;
                r = Number(r < 0 || isNaN(r)) ? 0 : ((r > 255) ? 255 : r).toString(16);
                if (r.length == 1) r = '0' + r;
                g = Number(g < 0 || isNaN(g)) ? 0 : ((g > 255) ? 255 : g).toString(16);
                if (g.length == 1) g = '0' + g;
                b = Number(b < 0 || isNaN(b)) ? 0 : ((b > 255) ? 255 : b).toString(16);
                if (b.length == 1) b = '0' + b;
                return "#" + r + g + b;
            }

            var makeKeyForAttributes = function(object, attributes) {
                var valuesToBeJoined = []
                for (i in attributes) {
                    valuesToBeJoined.push(object[attributes[i]])
                }
                return valuesToBeJoined.join('___')
            }

            var dictToArray = function(dict) {
                var arr = []
                for (var key in dict) {
                    if (Array.isArray(dict[key])) {
                        arr.push({'key': key, 'value': dict[key]})
                    } else {
                        arr.push({'key': key, 'value': dictToArray(dict[key])})
                    }
                }
                function compare(a, b) {
                    var knownKeys = ['new', 'validation', 'defined', 'submitted', 'done']
                    if (knownKeys.includes(a.key) && knownKeys.includes(b.key)) {
                        return knownKeys.indexOf(a.key) - knownKeys.indexOf(b.key);
                    }
                    if (!isNaN(parseInt(a.key, 10)) && !isNaN(parseInt(b.key, 10))) {
                        return parseInt(a.key, 10) - parseInt(b.key, 10);
                    }
                    if (a.key < b.key) {
                        return -1;
                    } else if  (a.key > b.key) {
                        return 1;
                    }
                    return 0;
                }
                arr = arr.sort(compare);
                return arr;
            }

            var prepareData = function(data) {
                scope.dataCopy = angular.copy(data);
                preparedData = {}
                scope.binSelectedCallback([])

                var allColorByKeys = []
                for (var i in data) {
                    var request = data[i]
                    var groupByKey = makeKeyForAttributes(request, scope.groupBy)
                    var colorByKey = makeKeyForAttributes(request, scope.colorBy)
                    var stackByKey = makeKeyForAttributes(request, scope.stackBy)
                    if (!(groupByKey in preparedData)) {
                        preparedData[groupByKey] = {}
                    }
                    if (!(colorByKey in preparedData[groupByKey])) {
                        preparedData[groupByKey][colorByKey] = {}
                    }
                    if (!(colorByKey in allColorByKeys)) {
                        allColorByKeys.push(colorByKey)
                    }
                    if (!(stackByKey in preparedData[groupByKey][colorByKey])) {
                        preparedData[groupByKey][colorByKey][stackByKey] = []
                    }
                    preparedData[groupByKey][colorByKey][stackByKey].push(request)
                }
                for (var group in preparedData) {
                    for (var colorByKey in allColorByKeys) {
                        if (!(allColorByKeys[colorByKey] in preparedData[group])) {
                            preparedData[group][allColorByKeys[colorByKey]] = {}
                        }
                    }
                }
                preparedData = dictToArray(preparedData)
                var flatData = [];
                var barMargin = 0.01;
                var subBarMargin = 0.005;
                var barWidth = (1.0 - (preparedData.length * barMargin))/ preparedData.length;
                for (var i = 0; i < preparedData.length; i++) {
                    preparedData[i].x0 = i * barWidth + (i + 1) * barMargin;
                    var subBarWidth = (barWidth - (preparedData[i].value.length * subBarMargin)) / preparedData[i].value.length;
                    for (var j = 0; j < preparedData[i].value.length; j++) {
                        preparedData[i].value[j].x0 = preparedData[i].x0 + j * subBarWidth + (j + 1) * subBarMargin;
                        var color = colorMap[preparedData[i].value[j].key]
                        if (color === undefined) {
                            color = '#2196f3'
                        }
                        var barY = 0.1;
                        for (var k = 0; k < preparedData[i].value[j].value.length; k++) {
                            preparedData[i].value[j].value[k].x0 = preparedData[i].value[j].x0;
                            preparedData[i].value[j].value[k].x1 = preparedData[i].value[j].x0 + subBarWidth;
                            preparedData[i].value[j].value[k].y0 = barY
                            var sum = 0;
                            if (scope.mode === 'events') {
                                sum = d3.sum(preparedData[i].value[j].value[k].value, function(d) { return d.total_events; })
                            } else if (scope.mode === 'seconds') {
                                sum = d3.sum(preparedData[i].value[j].value[k].value, function(d) { return d.total_events * d.time_event_sum; })
                            } else {
                                sum = preparedData[i].value[j].value[k].value.length;
                            }
                            preparedData[i].value[j].value[k].y1 = barY + sum;
                            preparedData[i].value[j].value[k].color = color;
                            preparedData[i].value[j].value[k].sum = sum;
                            color = getTintedColor(color, parseInt(80.0 / preparedData[i].value[j].value.length));
                            barY = preparedData[i].value[j].value[k].y1
                            flatData.push(preparedData[i].value[j].value[k])
                        }
                    }
                }
                console.log('Flat data')
                console.log(flatData)
                if (scope.scale === 'log') {
                    y = d3.scaleLog()
                } else {
                    y = d3.scaleLinear()
                }
                y = y.domain([0.1, d3.max(flatData, function(d) { return d.y1; }) * 1.05]).range([height, 0]);
                xAxis.ticks(10)
                yAxis.ticks(5)
                yAxis.scale(y);
                svg.selectAll("rect.bar").remove()
                svg.selectAll("text.bar-size-label").remove()
                svg.selectAll("g .x.axis").call(xAxis);
                svg.selectAll("g .y.axis").call(yAxis);
                svg.select(".x.axis")
                   .selectAll('text')
                   .style("font-size","14px");
                svg.select(".y.axis")
                   .selectAll('text')
                   .style("font-size","14px");

                var rect = svg.selectAll("rect")
                              .data(flatData)
                              .enter()

                function setTitle(d) {
                    if (d.value.length === 0) {
                        return ''
                    }
                    var title = '';
                    var forrmattedSum = d.sum;
                    if (scope.humanReadableNumbers) {
                        forrmattedSum = formatBigNumbers(forrmattedSum);
                    }
                    if (scope.mode === 'events') {
                        title += 'Events: ' + forrmattedSum + '\n';
                    } else if (scope.mode === 'seconds') {
                        title += 'Seconds: ' + forrmattedSum + '\n';
                    } else {
                        title += 'Requests: ' + forrmattedSum + '\n';
                    }
                    var keys = {'member_of_campaign': 'Campaign',
                                'total_events': 'Total Events',
                                'prepid': 'Prepid',
                                'status': 'Status',
                                'priority': 'Priority',
                                'pwg': 'PWG',
                                'is_member_of_chain': 'Member of chain'}
                    for (var i in scope.groupBy) {
                        var key = scope.groupBy[i]
                        title += keys[key] + ': ' + d.value[0][key] + '\n'
                    }
                    for (var i in scope.colorBy) {
                        var key = scope.colorBy[i]
                        title += keys[key] + ': ' + d.value[0][key] + '\n'
                    }
                    for (var i in scope.stackBy) {
                        var key = scope.stackBy[i]
                        title += keys[key] + ': ' + d.value[0][key] + '\n'
                    }
                    return title;
                }

                rect.append("rect")
                    .attr("fill", function(d) { return d.color; })
                    .attr("class", "bar")
                    .attr("transform", function(d) {
                       return "translate(" + x(d.x0) + "," + y(d.y1) + ")";
                    })
                    .attr("width", function(d) { return Math.max(0, x(d.x1) - x(d.x0)); })
                    .attr("height", function(d) { return y(d.y0) - y(d.y1); })
                    .on("mouseover", function() {
                        this.parentNode.appendChild(this);
                        d3.select(this).style("fill", '#bdbdbd');
                    })
                    .on('mousedown',function(d){
                        scope.binSelectedCallback(d.value)
                    })
                    .on("mouseout", function() {
                        d3.select(this).style("fill", function(d) { return d.color; });
                    }).append("svg:title").text(setTitle)
                    ;
            };

            scope.$watch('data', function(data) {
                if (data !== undefined && data.length) {
                    prepareData(data);
                }
            });
        }
    };
}])
