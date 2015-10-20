/**
 * @name multiplePieCharts.directive
 * @type directive
 * @description Creates donut charts showing completion of the campaign and status table
 */
.directive("multiplePieCharts", ['$compile', '$http', function ($compile, $http) {
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
            humanReadableNumbers: '=',
            colorDomain: "=?" // order of colors (colors are taken as 10 basic colors from d3.js)
        },
        link: function (scope, element) {
            var showTable;
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
                compactTerms.push('rest');
            }

            if (typeof scope.showTable === 'boolean' && scope.showTable === false) {
                showTable = false;
            } else {
                showTable = true;
            }

            var dataTermsFull = {};
            for (i = 0; i < fullTerms.length; i++) {
                dataTermsFull[fullTerms[i]] = i;
            }

            var dataTermsCompact = {};
            for (i = 0; i < compactTerms.length; i++) {
                dataTermsCompact[compactTerms[i]] = i;
            }

            nestBy.forEach(function (key) {
                nested.key(function (d) {
                    return d[key];
                });
            });
            nested.rollup(function (leaves) {
                return d3.sum(leaves, function (d) {
                    return d[sumBy];
                });
            });
            scope.$watch('data', function (dat) {
                scope.piechart_data = {};
                scope.piechart_data_full = {};
                scope.current_data = {};
                dat = dat || [];
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
                            piechart_data_full.terms[dataTermsFull[nested_data[i].values[
                                j].key]].count = nested_data[i].values[j].values;
                            if (nested_data[i].values[j].key in dataTermsCompact) {
                                piechart_data.terms[dataTermsCompact[nested_data[i].values[
                                    j].key]].count = nested_data[i].values[j].values;
                            } else {
                                piechart_data.terms[compactTerms.length - 1].count +=
                                    nested_data[i].values[j].values;
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

            scope.changeChart = function (name, term, state) {
                if (state.state) {
                    scope.current_data[state.key].data = scope.piechart_data[state.key];
                } else {
                    scope.current_data[state.key].data = scope.piechart_data_full[state.key];
                }
            };

            // domain for colors
            scope.domain = scope.colorDomain;

            $http.get('build/table.min.html').success(function (html) {
                element.append($compile(html)(scope));
            });
        }
    };
}])
