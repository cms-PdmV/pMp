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
            binSelectedCallback: '=',
            bigNumberFormatter: '=',
            bigNumberFormatterLog: '=',
            growingMode: '='
        },
        link: function(scope, element, compile, http) {
            // graph configuration
            config = {
                customWidth: 1160,
                customHeight: 620,
                margin: {
                    top: 40,
                    right: 10,
                    bottom: 170,
                    left: 80
                }
            };
            // General attributes
            var width = config.customWidth - config.margin.left - config.margin.right;
            var height = config.customHeight - config.margin.top - config.margin.bottom;
            // add main svg
            svg = d3.select(element[0])
                    .append('svg:svg')
                    .attr("viewBox", "0 -20 " + config.customWidth + " " + config.customHeight)
                    .attr("xmlns", "http://www.w3.org/2000/svg")
                    .attr("id", "plot-parent")
                    .append("svg:g")
                    .attr("id", "plot")
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

            // axes
            var x = d3.scaleLinear().range([0, width]);
            var xAxis = d3.axisBottom(x).ticks(10);
            var gx = svg.append("svg:g")
                .attr("class", "x axis minorx")
                .attr('fill', '#666')
                .attr("transform", "translate(0," + (height) + ")")
                .call(xAxis);

            var y = d3.scaleLinear().range([height, 0]).domain([0, 100]);
            var yAxis = d3.axisLeft(y).ticks(5).tickFormat(scope.bigNumberFormatter);
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

            function getRandomColor() {
                var r = Math.floor(Math.random() * 168) + 32;
                var g = Math.floor(Math.random() * 168) + 32;
                var b = Math.floor(Math.random() * 168) + 32;
                r = Number(r < 0 || isNaN(r)) ? 0 : ((r > 255) ? 255 : r).toString(16);
                if (r.length == 1) {
                    r = '0' + r;
                }
                g = Number(g < 0 || isNaN(g)) ? 0 : ((g > 255) ? 255 : g).toString(16);
                if (g.length == 1) {
                    g = '0' + g;
                }
                b = Number(b < 0 || isNaN(b)) ? 0 : ((b > 255) ? 255 : b).toString(16);
                if (b.length == 1) {
                    b = '0' + b;
                }
                return "#" + r + g + b;
            }

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
                var g = Math.abs(((rgb >> 8) & 0xFF) + v);
                var b = Math.abs((rgb & 0xFF) + v);
                r = Number(r < 0 || isNaN(r)) ? 0 : ((r > 255) ? 255 : r).toString(16);
                if (r.length == 1) {
                    r = '0' + r;
                }
                g = Number(g < 0 || isNaN(g)) ? 0 : ((g > 255) ? 255 : g).toString(16);
                if (g.length == 1) {
                    g = '0' + g;
                }
                b = Number(b < 0 || isNaN(b)) ? 0 : ((b > 255) ? 255 : b).toString(16);
                if (b.length == 1) {
                    b = '0' + b;
                }
                return "#" + r + g + b;
            }

            var makeKeyForAttributes = function(object, attributes) {
                var valuesToBeJoined = []
                for (i in attributes) {
                    valuesToBeJoined.push(object[attributes[i]])
                }
                return valuesToBeJoined.join('___')
            }

            var compare = function(a, b) {
                let aKey = a;
                let bKey = b;
                if (typeof a === 'object') {
                    aKey = a.key;
                }
                if (typeof b === 'object') {
                    bKey = b.key;
                }
                if (aKey.includes('___') && bKey.includes('___')) {
                    let aParts = aKey.split('___');
                    let bParts = bKey.split('___');
                    if (aParts.length != bParts.length) {
                        return aParts.length - bParts.length;
                    }
                    for (let i = 0; i < aParts.length; i++) {
                        let partDiff = compare(aParts[i], bParts[i]);
                        if (partDiff != 0) {
                            return partDiff;
                        }
                    }
                    return 0;
                }
                var knownKeys = ['n/a',
                                 'new', 'validation', 'defined', 'approved', 'submitted', 'done',
                                 'assignment-approved', 'assigned', 'staging', 'staged', 'acquired', 'running-open',
                                 'running-closed', 'force-complete', 'completed', 'closed-out', 'announced', 'normal-archived',
                                 'rejected', 'rejected-archived', 'failed', 'aborted', 'aborted-completed', 'aborted-archived'];
                if (knownKeys.includes(aKey) && knownKeys.includes(bKey)) {
                    return knownKeys.indexOf(aKey) - knownKeys.indexOf(bKey);
                }
                if (!isNaN(parseInt(aKey, 10)) && !isNaN(parseInt(bKey, 10))) {
                    return parseInt(aKey, 10) - parseInt(bKey, 10);
                }
                if (aKey < bKey) {
                    return -1;
                } else if  (aKey > bKey) {
                    return 1;
                }
                return 0;
            }

            var dictToArray = function(dict) {
                var arr = []
                for (var key in dict) {
                    if (Array.isArray(dict[key])) {
                        arr.push({'key': key, 'value': dict[key].sort(compare)})
                    } else {
                        arr.push({'key': key, 'value': dictToArray(dict[key])})
                    }
                }
                arr = arr.sort(compare);
                return arr;
            }

            var prepareData = function(data) {
                preparedData = {}
                scope.binSelectedCallback([])

                var allColorByKeys = []
                for (var i in data) {
                    var request = data[i]
                    request.key = request.prepid
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
                if (scope.mode === 'events' && scope.growingMode) {
                    for (var groupBy in preparedData) {
                        for (var colorBy in preparedData[groupBy]) {
                            for (var stackBy in preparedData[groupBy][colorBy]) {
                                for (var i in preparedData[groupBy][colorBy][stackBy]) {
                                    d = preparedData[groupBy][colorBy][stackBy][i]
                                    if (d.status === 'submitted') {
                                        var realTotal = d.total_events;
                                        var adjustment = d.completed_events
                                        d.total_events -= Math.min(adjustment, d.total_events)
                                        var newGroupBy = groupBy.replace('submitted', 'done')
                                        var newColorBy = colorBy.replace('submitted', 'done')
                                        var newStackBy = stackBy.replace('submitted', 'done')
                                        if (!(newGroupBy in preparedData)) {
                                            preparedData[newGroupBy] = {}
                                        }
                                        if (!(newColorBy in preparedData[newGroupBy])) {
                                            preparedData[newGroupBy][newColorBy] = {}
                                        }
                                        if (!(newStackBy in preparedData[newGroupBy][newColorBy])) {
                                            preparedData[newGroupBy][newColorBy][newStackBy] = []
                                        }
                                        if (adjustment > 0) {
                                            preparedData[newGroupBy][newColorBy][newStackBy].push({prepid: d.prepid,
                                                                                                   key: d.prepid,
                                                                                                   total_events: realTotal,
                                                                                                   priority: d.priority,
                                                                                                   priority_block: d.priority_block,
                                                                                                   member_of_chain: d.member_of_chain,
                                                                                                   member_of_campaign: d.member_of_campaign,
                                                                                                   status: 'done',
                                                                                                   dataset_name: d.dataset_name,
                                                                                                   growing_fake: true,
                                                                                                   completed_events: adjustment,
                                                                                                   url: d.url,
                                                                                                   workflow: d.workflow})
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                                                        
                preparedData = dictToArray(preparedData)
                var flatData = [];
                var barMargin = 0.001;
                var subBarMargin = 0.0;
                var barWidth = (0.98 - (preparedData.length * barMargin)) / preparedData.length;
                var usedColorKeys = [];
                for (var i = 0; i < preparedData.length; i++) {
                    preparedData[i].x0 = 0.02 + i * barWidth + (i + 1) * barMargin;
                    preparedData[i].x1 = preparedData[i].x0 + barWidth;
                    var subBarWidth = (barWidth - (preparedData[i].value.length * subBarMargin)) / preparedData[i].value.length;
                    for (var j = 0; j < preparedData[i].value.length; j++) {
                        preparedData[i].value[j].x0 = preparedData[i].x0 + j * subBarWidth + (j + 1) * subBarMargin;
                        preparedData[i].value[j].x1 = preparedData[i].value[j].x0 + subBarWidth;
                        var colorKey = preparedData[i].value[j].key
                        if (colorKey === undefined || colorKey === '') {
                            color = '#2196f3'
                        } else {
                            color = colorMap[colorKey]
                            if (color === undefined) {
                                color = getRandomColor()
                            }
                            colorMap[colorKey] = color
                            if (!(usedColorKeys.includes(colorKey))) {
                                usedColorKeys.push(colorKey)
                            }
                        }
                        
                        var barY = (scope.scale === 'log' ? 0.1 : 0);
                        for (var k = 0; k < preparedData[i].value[j].value.length; k++) {
                            preparedData[i].value[j].value[k].x0 = preparedData[i].value[j].x0;
                            preparedData[i].value[j].value[k].x1 = preparedData[i].value[j].x0 + subBarWidth;
                            preparedData[i].value[j].value[k].y0 = barY
                            var sum = 0;
                            if (scope.mode === 'events') {
                                sum = d3.sum(preparedData[i].value[j].value[k].value, function(d) { return d.status === 'done' ? d.completed_events : d.total_events; })
                            } else if (scope.mode === 'seconds') {
                                sum = d3.sum(preparedData[i].value[j].value[k].value, function(d) { return d.total_events * d.time_event_sum; })
                            } else {
                                sum = preparedData[i].value[j].value[k].value.length;
                            }
                            sum = Math.max(0, sum)
                            preparedData[i].value[j].value[k].y1 = preparedData[i].value[j].value[k].y0 + sum;
                            preparedData[i].value[j].value[k].color = color;
                            preparedData[i].value[j].value[k].sum = sum;
                            color = getTintedColor(color, parseInt(80.0 / preparedData[i].value[j].value.length));
                            barY = preparedData[i].value[j].value[k].y1
                            flatData.push(preparedData[i].value[j].value[k])
                        }
                    }
                }
                var legendHeight = ((1 + parseInt(usedColorKeys.length / 4)) * 20);
                for (var i = 0; i < usedColorKeys.length; i++) {
                    usedColorKeys[i] = {index: i,
                                        x: i % 4 * ((config.customWidth - 40) / 4),
                                        y: parseInt(i / 4) * 20 - legendHeight,
                                        key: usedColorKeys[i],
                                        color: colorMap[usedColorKeys[i]]}
                }

                d3.select("#plot").attr("transform", "translate(80, " + (legendHeight + config.margin.top) + ")")
                d3.select("#plot-parent").attr("viewBox", "0 -20 " + config.customWidth + " " + (config.customHeight + legendHeight))

                usedColorKeys = usedColorKeys.sort(compare);
                var xAxisLabels = [];
                if (preparedData[0].key !== '') {
                    for (var i = 0; i < preparedData.length; i++) {
                        xAxisLabels.push({key: preparedData[i].key.replace(/___/g, ', '),
                                          x: preparedData[i].x0 + ((preparedData[i].x1 - preparedData[i].x0) / 2.0)})
                    }
                } else if (preparedData[0].value[0].key !== '') {
                    for (var i = 0; i < preparedData[0].value.length; i++) {
                        xAxisLabels.push({key: preparedData[0].value[i].key.replace(/___/g, ', '),
                                          x: preparedData[0].value[i].x0 + ((preparedData[0].value[i].x1 - preparedData[0].value[i].x0) / 2.0)})
                    }
                } else {
                    xAxisLabels.push({key: 'All', x: 0.5})
                }
                var topMargin = 1.05;
                if (scope.scale === 'log') {
                    y = d3.scaleLog()
                    yAxis = yAxis.tickFormat(scope.bigNumberFormatterLog)
                    topMargin = 10;
                } else {
                    y = d3.scaleLinear()
                    yAxis = yAxis.tickFormat(scope.bigNumberFormatter)
                }
                var maxValue = d3.max(flatData, function(d) { return d.y1; });
                y = y.domain([(scope.scale === 'log' ? 0.1 : 0), maxValue * topMargin]).range([height, 0]);
                // xAxis.ticks(xAxisLabels.length)
                xAxis.tickValues(Array.from(xAxisLabels, x => x.x - barMargin / 2))
                xAxis.tickFormat(function(d, i) { return xAxisLabels[i].key; })
                yAxis.ticks(Math.min(5,maxValue))
                yAxis.scale(y);
                svg.selectAll("rect.bar").remove()
                svg.selectAll(".selected-bar").remove()
                svg.selectAll("text.bar-size-label").remove()
                svg.selectAll("g .x.axis").call(xAxis);
                svg.selectAll("g .y.axis").call(yAxis);
                svg.selectAll(".legend").remove()
                svg.selectAll("circle").remove()
                svg.selectAll(".grayline").remove();
                svg.select(".x.axis")
                   .selectAll('text')
                   .style("font-size","14px");
                svg.select(".y.axis")
                   .selectAll('text')
                   .style("font-size","14px");

                var rect = svg.selectAll("rect .bar")
                              .data(flatData)
                              .enter()

                function setTitle(d) {
                    if (d.value.length === 0) {
                        return ''
                    }
                    var title = '';
                    var forrmattedSum = d.sum;
                    if (scope.humanReadableNumbers) {
                        forrmattedSum = scope.bigNumberFormatter(forrmattedSum);
                    }
                    if (scope.mode === 'events') {
                        title += 'Events: ' + forrmattedSum + '\n';
                    } else if (scope.mode === 'seconds') {
                        title += 'Seconds: ' + forrmattedSum + '\n';
                    } else {
                        title += 'Requests: ' + forrmattedSum + '\n';
                    }
                    var keys = {'member_of_campaign': 'Campaign',
                                'total_events': 'Total events',
                                'prepid': 'Prepid',
                                'status': 'Status',
                                'priority': 'Priority',
                                'priority_block': 'Priority block',
                                'pwg': 'PWG',
                                'is_member_of_chain': 'Member of chain',
                                'workflow_status': 'Workflow status'}
                    for (var i in scope.groupBy) {
                        var key = scope.groupBy[i]
                        if (key in keys) {
                            let value = d.value[0][key]
                            if (value) {
                                value = value.toString().replace('Block ', '')
                            }
                            title += keys[key] + ': ' + value + '\n'
                        }
                    }
                    for (var i in scope.colorBy) {
                        var key = scope.colorBy[i]
                        if (key in keys) {
                            let value = d.value[0][key]
                            if (value) {
                                value = value.toString().replace('Block ', '')
                            }
                            title += keys[key] + ': ' + value + '\n'
                        }
                    }
                    for (var i in scope.stackBy) {
                        var key = scope.stackBy[i]
                        if (key in keys) {
                            let value = d.value[0][key]
                            if (value) {
                                value = value.toString().replace('Block ', '')
                            }
                            title += keys[key] + ': ' + value + '\n'
                        }
                    }
                    return title.trim();
                }

                svg.selectAll('line .grayline')
                   .data(yAxis.scale().ticks().filter(Boolean))
                   .enter()
                   .append('line')
                   .attr('class', 'grayline')
                   .attr('x1', 0)
                   .attr('y1', function(d) { return y(d) })
                   .attr('x2', width)
                   .attr('y2', function(d) { return y(d) })

                rect.append("rect")
                    .attr("fill", function(d) { return d.color; })
                    .attr("class", "bar")
                    .attr("transform", function(d) {
                        return "translate(" + x(d.x0 - barMargin / 2) + "," + y(d.y1) + ")";
                    })
                    .attr("width", function(d) { return Math.max(0, x(d.x1) - x(d.x0)); })
                    .attr("height", function(d) { return Math.max(0, y(d.y0) - y(d.y1)); })
                    .on("mouseover", function() {
                        d3.select(this).style("fill", '#bdbdbd');
                    })
                    .on('mousedown',function(d) {
                        d3.selectAll(".selected-bar").remove()
                        var selectedRect = rect.append("rect")
                                               .attr("class", "selected-bar")
                                               .attr("transform", "translate(" + x(d.x0 - barMargin / 2) + "," + y(d.y1) + ")")
                                               .attr("width", Math.max(0, x(d.x1) - x(d.x0)))
                                               .attr("height", y(d.y0) - y(d.y1))
                                               .style("fill", "url(#diagonal-stripes)")
                        selectedRect.on('mousedown',function(d) {
                            d3.selectAll(".selected-bar").remove()
                            scope.binSelectedCallback([]);
                        })
                        scope.binSelectedCallback(d.value);
                    })
                    .on("mouseout", function() {
                        d3.select(this).style("fill", function(d) { return d.color; });
                    })
                    .append("svg:title").text(setTitle);

                var legendCircle = svg.selectAll("circle")
                                      .data(usedColorKeys)
                                      .enter()

                legendCircle.append("circle")
                            .attr("cx", function(d) {return d.x })
                            .attr("cy", function (d) { return d.y - 6})
                            .attr("class", "legend")
                            .attr("r", 8)
                            .style("fill", function (d) { return d.color; })

                legendCircle.append("text")
                            .attr("transform", function (d) { return "translate(" + (d.x + 12) + ", " + d.y + ")"})
                            .text(function (d) { return d.key; })
                            .style("font-size", "15px")
                            .attr("class", "legend")
                            .style("fill", "black")

                svg.append("text")
                   .text(scope.mode.toUpperCase())
                   .style("fill", "#333")
                   .attr("class", "legend")
                   .style("text-anchor"," end")
                   .attr("transform", "rotate(-90) translate(-4, 16)")

                svg.selectAll(".x.axis .tick>text")
                   .style("text-anchor"," end")
                   .attr("transform", "rotate(-32)")
                   .style("fill", "#333")
                   .style("text-transform", "uppercase")
            };

            scope.$watch('data', function(data) {
                if (data !== undefined && data.length) {
                    prepareData(angular.copy(data));
                }
            });
        }
    };
}])
