/**
 * @name statsTable.directive
 * @type directive
 * @description Show key statistics for loaded campaign
 */
.directive('statsTable', ['$compile', '$http', function ($compile, $http) {
    return {
        restrict: 'AE',
        scope: {
            chartData: '=',
            minuend: '=',
            subtrahend: '='
        },
        link: function (scope, element) {
            var dataStats = [],
                dataStatsExtended = [];
            var dateFormat = d3.time.format("%Y-%m-%d-%H-%M");
            var getDate = function (d) {
                return dateFormat.parse(d)
            };

            // recalculate statistics
            var updateStats = function () {
                if (dataStats.length) {
                    scope.statistics = {};
                    scope.statistics.max = d3.max(dataStats, function (d) {
                        return d;
                    });
                    scope.statistics.mean = d3.mean(dataStats, function (d) {
                        return d;
                    });
                    scope.statistics.median = d3.median(dataStats, function (d) {
                        return d;
                    });
                    scope.statistics.min = d3.min(dataStats, function (d) {
                        return d;
                    });
                    scope.statistics.population = dataStats.length;
                    scope.statistics.range = scope.statistics.max - scope.statistics.min;
                } else {
                    scope.statistics = {
                        max: 0,
                        mean: 0,
                        median: 0,
                        min: 0,
                        population: 0,
                        range: 0,
                    };
                }
            };

            // react to input change, calculate differences and apply
            var inputChange = function () {
                var m = scope.minuend;
                var s = scope.subtrahend;
                if (m === '' || s === '') {
                    return null;
                }
                dataStats = [];
                dataStatsExtended = [];
                var d = scope.chartData;
                if (d !== undefined) {
                    d.forEach(function (e, i) {
                        var history = e.history;
                        if (Object.keys(history)) {
                            if (history[m] !== undefined && history[s] !==
                                undefined) {
                                var tmp = getDate(history[m]) - getDate(history[s]);
                                dataStats.push(tmp);
                                dataStatsExtended.push({
                                    id: e.prepid,
                                    value: tmp
                                });
                            }
                        }
                    });
                    scope.$parent.applyHistogram(dataStats, dataStatsExtended);
                    updateStats();
                }
            };

            updateStats();
            $http.get('build/stats-table.min.html').success(function (html) {
                element.append($compile(html)(scope));
            });

            scope.$watch('chartData', function (d) {
                inputChange();
            });
            scope.$watch('minuend', function (d) {
                inputChange();
            });
            scope.$watch('subtrahend', function (d) {
                inputChange();
            });
        }
    };
}])