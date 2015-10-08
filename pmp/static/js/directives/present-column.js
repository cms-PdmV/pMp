    .directive('columnChart', function(){
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
                priorityMarkup: '=?', // highlight priority blocks
                responsive: '=?', // should the chart be responsive to the webpage size
                duration: '=?', // duration of animations
                legend: '=?', // should the color legend be shown
                userWidth: '=?width', // optional width of chart
                userHeight: '=?height', // optional height of chart
                sort: '=?' // should the values in columns be sorted
            },
            link: function(scope, element, attrs) {
                var highlight_color = "#bdbdbd";
                var margin = {top: 10, right: 0, bottom: 160, left: 50};
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

                var config = {
                    blockSeparatorColor: '#a80000',
                    blockSeparatorClass: 'block-separator',
                    blockSeparatorOpacity: '0.2',
                    blockSeparatorWidth: 6
                }

                // create base SVG (and translate it to the start of plot)
                main_svg = d3.select(element[0]).append("svg")
                    .attr("preserveAspectRatio", "xMidYMin meet")
                    .attr("font-size", "12px");
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
                    .attr("class", "grid horizontal")
                    .attr("fill", "none")
                    .attr("stroke", "#ffffff")
                    .attr("stroke-width", 1);

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
                    TSG: '#ffb74d' // orange 300
                };

                /*
                 * Used for generating shaded color for stacking
                 * @color - original color
                 * @v - jump
                 * Credits: Richard Maloney 2006
                 */
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
                }

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

                function changeWidthHeight() {
                    width = scope.userWidth || 1125;
                    height = 400;
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
                                    t[value] = d3.sum(filtered_leaves[i].values,
                                                      function(d) {
                                                          return d['total_events']
                                                      });
                                } else if (valueOperation == 'requests') {
                                    t[value] = filtered_leaves[i].values.length;
                                } else if (valueOperation == 'seconds') {
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
                    yAxis.tickFormat(d3.format(""));
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

                    var maxHeight = 0;

                    //setTimeout(function() {
                            var fontSizeAdjustable = "10px";
                            var classedAdjustable = "text-uppercase";
                            if((grouping.length && grouping[0] === "prepid") || (!grouping.length && columns === "prepid")) {
                                fontSizeAdjustable = "8px";
                                classedAdjustable = "";
                            }

                            svg.select(".x.axis").transition().duration(duration)
                                .call(xAxis).selectAll(".x.axis .tick")
                                /*    .call(endall, function(){
                                        svg.selectAll('.x.axis path').style('display', 'none'); 
                                        svg.selectAll('.x.axis line').style('stroke', '#aaaaaa');
                                        svg.selectAll(".x.axis .tick")
                                            .filter(function(){
                                                    return d3.select(this).select("title").empty()
                                                        })
                                            .append("title");
                                        drawBlockSeparations();
                                        svg.selectAll(".x.axis .tick title").text(function(d){
                                                var descriptionString = '';
                                    if(valueOperation == 'events') {
                                        descriptionString = 'Number of events';
                                    } else if(valueOperation == 'requests') {
                                        descriptionString = 'Number of requests';
                                    } else if(valueOperation == 'seconds') {
                                        descriptionString = 'Seconds per event';
                                    }
                                    descriptionString += ": " + d3.sum(svg.selectAll("rect.grouping" + d).data(), function(d){ return d[value];});
                                    return d + "\n" + descriptionString;
                                });
                                    })
                                .selectAll("text").attr("class", classedAdjustable).style("text-anchor", "end").style("font-size", fontSizeAdjustable).style("font-weight", "lighter").style("cursor", "default").attr("dx", "-0.5em").attr("dy", "0.5em").attr("transform", "rotate(-55)")
                                .each(function(){
                                maxHeight = d3.max(this.getBBox().width, maxHeight)
                                });*/
                            //}, 0);
                    
                    svg.selectAll(".x.axis text")
                        .on("mouseover", function(d) {
                           svg.selectAll("rect.grouping" + d).style("fill", highlight_color);
                        })
                        .on("mouseout", function(d) {
                                svg.selectAll("rect.grouping" + d).style("fill", function(d) {return colors(d);});
                            });

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
                        sums = sums.filter(function(el) {
                            return el!=0;
                        });
                        sums.push(d3.min(sums)-d3.min(sums)/5); // for nicer formatting of data
                    } else {
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
                                /*.call(endall, function(){
                                    svg_group.exit().remove();
                                    });*/
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
                        /*.call(endall, function(){
                            svg_group.selectAll(".group.lvl"+l).remove();
                            });*/

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
                        .attr("height", 0)
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
                        // TODO: EXPORT TO GLOBAL CONFIG
                        var legendDotRadius = 8;
                        var legendFontSize = '10px';
                        var legendColumnSpacing = 10;
                        var legendRowHeight = 24;
                        var legendGraphSpacing = 10;
                        var legendAnimationDelay = 500;

                        setTimeout(function() {
                                var l = svg.select('g.legend');
                                if (l.empty()) {
                                    svg.append('g').attr('class', 'legend');
                                } else {
                                    l.selectAll('*').remove();
                                }

                                l = svg.select('.legend').selectAll('g').data(columns_domain);
                                var newLegend = l.enter().append('g').attr('class', 'legend-inst');
                                newLegend.append('svg:circle').attr('r', legendDotRadius).style('fill', function(d) { if (colorMap[d] != undefined) {return colorMap[d];} else {return colors_stacks[d](0);}});
                                newLegend.append('text').attr('x', legendDotRadius*1.5).attr('y', legendDotRadius/2).style('cursor', 'default').style('font-size', legendFontSize).style('text-transform', 'uppercase');
                                newLegend.append('title');

                                l.select('text').text(function(d) { return d;});
                                l.select('title')
                                    .text(function(d) {
                                            var hoverDescription = '';
                                            if (valueOperation == 'events') {
                                                hoverDescription = 'Number of events';
                                            } else if (valueOperation == 'requests') {
                                                hoverDescription = 'Number of requests';
                                            } else if (valueOperation == 'seconds') {
                                                hoverDescription = 'Seconds per event';
                                            }
                                            var sumValue = d3.sum(svg.selectAll("rect.columning" + d).data(),
                                                                  function(d) { return d[value];});
                                            return ('Value: ' + d + "\n" + hoverDescription + ": " + sumValue);
                                        });
                                l.on("mouseover", function(d) {
                                        svg.selectAll("rect.columning" + d).style("fill", highlight_color);
                                    });
                                l.on("mouseout", function(d) {
                                        svg.selectAll("rect.columning" + d).style("fill", function(d) { return colors(d)});
                                    });
                                
                                var tmpAll = svg.selectAll('g.legend-inst');
                                var tmpXOffset = 0, tmpYOffset = 0;
                                tmpAll[0].forEach(function(d, i) {
                                        var c = d3.select(d);
                                        var w = c[0][0].getBBox().width;
                                        if (w + tmpXOffset > (width + margin.right)) {
                                            tmpXOffset = 0;
                                            tmpYOffset += 1;
                                        }
                                        c.attr("transform", "translate("+ tmpXOffset + ", " + (tmpYOffset * legendRowHeight) + ")");
                                        tmpXOffset += w
                                            tmpXOffset += legendColumnSpacing
                                            });
                                var l = svg.select('g.legend');
                                l.attr('transform', 'translate(0,' + (-legendRowHeight*(tmpYOffset+1)) + ')');
                                svg.attr('transform', 'translate(50,' + (legendGraphSpacing+legendRowHeight*(tmpYOffset+1)) + ')');
                                main_svg.attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom + legendGraphSpacing + legendRowHeight*(tmpYOffset+1)));
                                main_svg.attr("height", height + margin.top + margin.bottom + legendGraphSpacing + legendRowHeight*(tmpYOffset+1));
                            }, legendAnimationDelay);
                    } else {
                        svg.select(".legend").remove();
                    }
                }

                /*
                 * Draw block separations if necessary
                 */
                function drawBlockSeparations() {
                    var priorityPerBlock = {1: 110000, 2: 90000, 3: 85000, 4: 80000, 5: 70000, 6: 63000};
                    // remove all block separations
                    svg.selectAll('.' + config.blockSeparatorClass).remove();
                    // terminate if the grouping is not by priority
                    if (grouping != 'priority' || !scope.priorityMarkup) {
                        return null;
                    }

                    // get coordinates
                    var blockXCoordinates = [0,0,0,0,0,0];
                    var xTicks = svg.selectAll(".x.axis .tick");
                    xTicks.forEach(function(d, i) {
                            d.forEach(function(e, j) {
                                    var x = d3.select(e).attr('transform')
                                        .split('(')[1].split(',')[0];
                                    var f = e['__data__'];
                                    for(var i = 6; i > 0; i--) {
                                        var g = priorityPerBlock[i];
                                        if (f == '' || f <= g) {
                                            if (f == g) {
                                                blockXCoordinates[6-i] = x;
                                            } else {
                                                blockXCoordinates[6-i] = x-column_width/2;
                                            }
                                        }
                                    }
                                });
                        });
                    // draw blocks
                    var tmp = 0;
                    blockXCoordinates.forEach(function(d, i) {
                                if (parseInt(d,10) > parseInt(tmp,10)) {
                                    var w = d;
                                    svg.append('g')
                                        .attr('class', config.blockSeparatorClass)
                                        .attr('transform', 'translate(' + w + ',0)')
                                        .append('line')
                                        .attr('x2', 0)
                                        .attr('y2', height)
                                        .attr('opacity', config.blockSeparatorOpacity)
                                        .style('stroke', config.blockSeparatorColor)
                                        .style('stroke-dasharray', ('3, 6'))
                                        .style('stroke-width', config.blockSeparatorWidth)
                                        .append('title')
                                        .text(function(){return "B"+(6-i)});
                                tmp = d;
                            }
                        });
                }
                
                function updateStylesheet() {
                    svg.selectAll('.domain').style('stroke', '#777777').style('fill', 'none');
                    svg.selectAll('.y line').style('stroke', '#777777').style('fill', 'none');
                    svg.selectAll('.x path').style('stroke', '#777777').style('fill', 'none');
                    svg.selectAll('.grid g').style('stroke', '#aaaaaa').style('stroke-width', '0.4');
                    svg.selectAll('.grid path').style('display', 'none');
                    svg.selectAll('.x g').style('stroke-width', '0');
                }

                function redraw() {
                    console.log('redraw');
                    prepareArguments();
                    changeWidthHeight();
                    updateDataStructure();
                    updateDomains();
                    updateData();
                    updateScales();
                    draw();
                    updateAxes();
                    updateStylesheet();
                }

                scope.$watchGroup(['data', 'stacking', 'grouping', 'columns', 'yScaleType', 'valueOperation', 'priorityMarkup'], function(dat) {
                    redraw();
                });
            }
        }
        })