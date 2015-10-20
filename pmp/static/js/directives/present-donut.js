/**
 * @name donutChart.directive
 * @type directive
 * @description Creates one donut chart showing completion of the campaign
 */
.directive('donutChart', function () {
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
        link: function (scope, element, attrs) {

            // Setup default parameters.
            var outerRadius = scope.outerRadius || 200;
            var innerRadius = scope.innerRadius || 0;
            var fontSize = scope.fontSize || 26;
            var duration = 800;
            var color;

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
                color = function (term) {
                    return scope.colorMap[term];
                };
            }

            // width and height
            var w = (outerRadius * 2) + fontSize * 5;
            var h = outerRadius * 2 + fontSize * 3;

            var arc = d3.svg.arc()
                .outerRadius(outerRadius - 10)
                .innerRadius(innerRadius);

            var pie = d3.layout.pie()
                .sort(null)
                .value(function (d) {
                    return d.count;
                });

            var svg = d3.select(element[0])
                .append('svg')
                .attr('width', w).attr('height', h);

            var arcs = svg.append('g')
                .attr('transform', 'translate(' + (w / 2) + "," + (h / 2) +
                    ') rotate(180) scale(-1, -1)');

            var labels = svg.append("g")
                .attr("class", "label_group")
                .attr("transform", "translate(" + (w / 2) + "," + (h / 2) + ")");

            function setTitleForTitle() {
                var data = "";
                for (var i = 0; i < scope.data.terms.length; i++) {
                    data += "\n" + scope.data.terms[i].term + ": " + scope.data.terms[i].count;
                }
                return scope.innerTitle + data;
            }

            var innerTitle = labels.append("g")
                .append("svg:text")
                .attr("text-anchor", "middle")
                .attr('font-size', fontSize - 8)
                .attr('font-weight', 'bold')
                .attr("transform", "translate(0," + (((fontSize - 8) / 5) + 1) + ")");

            d3.select(innerTitle.node().parentNode)
                .append('title')
                .text(function () {
                    return setTitleForTitle();
                });

            if (scope.onClickTitle) {
                innerTitle
                    .attr('cursor', 'pointer')
                    .on('mousedown', function (d) {
                        scope.$apply(function () {
                            (scope.onClickTitle || angular.noop)(field, scope.innerTitle,
                                scope.data.status);
                        });
                    });
            }

            attrs.$observe('innerTitle', function (v) {
                innerTitle.text(v);
                d3.select(innerTitle.node().parentNode).select('title').text(
                    setTitleForTitle());
            });

            scope.$watch('data', function (data) {
                d3.select(innerTitle.node().parentNode).select('title').text(
                    setTitleForTitle());

                function arcTween(d, i2) {
                    var i = d3.interpolate(this._current, d);
                    this._current = i(0);
                    return function (t) {
                        return arc(i(t));
                    };
                }

                function arcTweenExit(d, i2) {
                    var i = d3.interpolate(d, {
                        data: d.data,
                        startAngle: d.startAngle,
                        endAngle: d.startAngle,
                        value: 0
                    });
                    return function (t) {
                        return arc(i(t));
                    };
                }

                function textTween(d, i) {
                    var a = (this._current.startAngle + this._current.endAngle - Math.PI) /
                        2;
                    var b = (d.startAngle + d.endAngle - Math.PI) / 2;
                    this._current = d;
                    var fn = d3.interpolateNumber(a, b);
                    return function (t) {
                        var val = fn(t);
                        return "translate(" +
                            Math.cos(val) * (outerRadius - 5) + "," +
                            Math.sin(val) * (outerRadius - 5) + ")";
                    };
                }

                var findAnchor = function (d) {
                    if ((d.startAngle + d.endAngle) / 2 < Math.PI) {
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
                    for (var ii = 0; ii < data_insides.length; ii++) {
                        sum += data_insides[ii].count;
                    }

                    // if the sum is 0 then this facet has no valid entries (all counts were zero)
                    if (sum > 0) {
                        // update the arcs
                        var path = arcs.selectAll('path').data(pieData);

                        path.each(function (d) {
                            d3.select(this)
                                .select("title")
                                .text(d.data.term + "\n" + d.value + " (" + ((d.value /
                                    sum) * 100).toFixed(1) + "%)");
                        });

                        path.enter()
                            .append('path')
                            .attr('d', arc)
                            .attr('stroke', '#fff')
                            .attr('stroke-width', '1.5')
                            .style('fill', function (d) {
                                return color(d.data.term);
                            })
                            .each(function (d) {
                                this._current = {
                                    data: d.data,
                                    startAngle: d.startAngle,
                                    endAngle: d.startAngle,
                                    value: 0
                                };
                            })
                            .append('title')
                            .text(function (d) {
                                return d.data.term + "\n" + d.value + " (" + ((d.value /
                                    sum) * 100).toFixed(1) + "%)";
                            });

                        if (scope.onClick) {
                            path
                                .attr('cursor', 'pointer')
                                .on('mousedown', function (d) {
                                    scope.$apply(function () {
                                        (scope.onClick || angular.noop)(field,
                                            d.data.term, scope.data.status);
                                    });
                                });
                        }

                        path
                            .on("mouseover", function () {
                                this.parentNode.appendChild(this);
                                d3.select(this).attr('stroke', '#AAA');
                            })
                            .on("mouseout", function () {
                                d3.select(this).attr('stroke', '#fff');
                            })
                            .transition()
                            .style('fill', function (d) {
                                return color(d.data.term);
                            })
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
                            .data(pieData.length <= 2 ? pieData.filter(function (d) {
                                return d.value;
                            }) : pieData.filter(function (d) {
                                return d.value / sum > 0.05;
                            }));

                        percentLabels.enter().append("text")
                            .attr("class", "value")
                            .attr('font-size', fontSize - 10)
                            .attr('font-weight', 'bold')
                            .attr("transform", function (d) {
                                return "translate(" +
                                    Math.cos(((d.startAngle + d.endAngle - Math.PI) /
                                        2)) * (outerRadius) + "," +
                                    Math.sin((d.startAngle + d.endAngle - Math.PI) /
                                        2) * (outerRadius) + ")";
                            })
                            .each(function (d) {
                                this._current = d;
                            });

                        percentLabels.attr('text-anchor', findAnchor)
                            .text(function (d) {
                                return ((d.value / sum) * 100).toFixed(1) + "%";
                            });

                        // run the transition
                        percentLabels
                            .transition()
                            .duration(duration)
                            .attr("dy", function (d) {
                                if ((d.startAngle + d.endAngle) / 2 > Math.PI / 2 &&
                                    (d.startAngle + d.endAngle) / 2 < Math.PI * 1.5) {
                                    return 17;
                                } else {
                                    return -17;
                                }
                            })
                            .attrTween("transform", textTween);

                        // flush old entries
                        percentLabels.exit().remove();

                        // update the value labels
                        var nameLabels = labels.selectAll("text.units").data(pieData.length <=
                            2 ? pieData.filter(function (d) {
                                return d.value;
                            }) : pieData.filter(function (d) {
                                return d.value / sum > 0.05;
                            }));

                        nameLabels.enter()
                            .append("text")
                            .attr("class", "units text-uppercase")
                            .attr('font-size', fontSize - 15)
                            .attr('stroke', 'none')
                            .attr("transform", function (d) {
                                return "translate(" +
                                    Math.cos(((d.startAngle + d.endAngle - Math.PI) /
                                        2)) * (outerRadius) + "," +
                                    Math.sin((d.startAngle + d.endAngle - Math.PI) /
                                        2) * (outerRadius) + ")";
                            })
                            .each(function (d) {
                                this._current = d;
                            });

                        nameLabels
                            .attr('text-anchor', findAnchor)
                            .text(function (d) {
                                return d.data.term;
                            });

                        // run the transition
                        nameLabels
                            .transition()
                            .duration(duration)
                            .attr("dy", function (d) {
                                if ((d.startAngle + d.endAngle) / 2 > Math.PI / 2 &&
                                    (d.startAngle + d.endAngle) / 2 < Math.PI * 1.5) {
                                    return fontSize + 6;
                                } else {
                                    return fontSize - 28;
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