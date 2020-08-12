/**
 * @name performance.controller
 * @type controller
 * @description Performance Graph Controller
 */
angular.module('pmpApp').controller('PerformanceController', ['$http',
                                                              '$interval',
                                                              '$location',
                                                              '$rootScope',
                                                              '$scope',
                                                              '$timeout',
                                                              'PageDetailsProvider',
                                                              'Data',
    function ($http, $interval, $location, $rootScope, $scope, $timeout, PageDetailsProvider, Data) {
        'use strict';

        /**
         * @description Holds information about parameter defaults
         */
        $scope.defaults = {
            r: '', // search term
            bins: 20, // histogram bins
            subtrahend: 'created', // subtrahend
            minuend: 'done', // minuend
            scale: 'linear', // linear scale? false = log
            priority: undefined, // priority filter
            status: undefined, // status filter
            pwg: undefined, // PWG filter
            interested_pwg: undefined, // Interested PWG filter
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.performance;
            $scope.selectedBin = [];

            $scope.loadingData = false;
            Data.reset(true);
            $scope.data = undefined;
            $scope.firstLoad = true;
            $scope.changeActiveIndex(3);
            // collect URL parameters together
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)
            // define graph difference
            $scope.minuend = urlParameters.minuend;
            $scope.subtrahend = urlParameters.subtrahend;
            $scope.availableStatuses = [];
            $scope.availableScales = ['linear', 'log'];
            // if linear scale
            $scope.scale = urlParameters.scale;

            // set number of bins
            $scope.bins = parseInt(urlParameters.bins, 10);

            $scope.sortSelectedOn = 'prepid';
            $scope.sortSelectedOrder = 1;

            // initialise filters
            if (urlParameters.priority !== undefined) {
                Data.setPriorityFilter(urlParameters.priority.split(','));
            }

            if (urlParameters.status !== undefined) {
                var s = {}
                var tmp = urlParameters.status.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    s[tmp[i]] = true;
                }
                Data.setStatusFilter(s);
            }

            if (urlParameters.pwg !== undefined) {
                var w = {}
                var tmp = urlParameters.pwg.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    w[tmp[i]] = true;
                }
                Data.setPWGFilter(w);
            }

            if (urlParameters.interested_pwg !== undefined) {
                var w = {}
                var tmp = urlParameters.interested_pwg.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    w[tmp[i]] = true;
                }
                Data.setInterestedPWGFilter(w);
            }

             // load graph data
            if (urlParameters.r !== '') {
                Data.setInputTags(urlParameters.r.split(','));
            } else {
                Data.setInputTags([]);
            }
        };

        /**
         * @description Core: Query API
         * @param {String} request User input.
         * @param {Boolean} add Append results if true
         */
        $scope.load = function (request, add) {
            if (!request) {
                $scope.showPopUp('warning', 'Empty search field');
                return;
            }
            if (request.constructor == Object) {
                request = request.label;
            }
            if (add && Data.getInputTags().indexOf(request) !== -1) {
                $scope.showPopUp('warning', 'Object is already loaded');
            } else {
                if (!add) {
                    // Reset data and filters
                    Data.reset(true);
                }
                Data.addInputTag(request);
            }
        };

        /**
         * @description Core: Parse filters to query API
         * @param {Boolean} filter If filter data is present.
         */
        $scope.query = function () {
            $scope.messages = [];
            var inputTags = Data.getInputTags();
            if (inputTags.length === 0) {
                Data.setLoadedData([]);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                Data.setInterestedPWGFilter({});
                $scope.data = Data.getLoadedData();
                $scope.setURL($scope, Data);
                $scope.$broadcast('onChangeNotification:LoadedData');
                $timeout(function(){
                    $scope.$apply();
                });
                return null;
            }
            $scope.loadingData = true;
            var priorityQuery = Data.getPriorityQuery();
            var statusQuery = Data.getStatusQuery($scope.firstLoad);
            var pwgQuery = Data.getPWGQuery($scope.firstLoad);
            var interestedPWGQuery = Data.getInterestedPWGQuery($scope.firstLoad);
            $scope.firstLoad = false;
            var queryUrl = 'api/performance?r=' + inputTags.slice().sort().join(',');
            if (priorityQuery !== undefined) {
                queryUrl += '&priority=' + priorityQuery;
            }
            if (statusQuery !== undefined) {
                queryUrl += '&status=' + statusQuery;
            }
            if (pwgQuery !== undefined) {
                queryUrl += '&pwg=' + pwgQuery;
            }
            if (interestedPWGQuery !== undefined) {
                queryUrl += '&interested_pwg=' + interestedPWGQuery;
            }
            var promise = $http.get(queryUrl);
            promise.then(function (data) {
                $scope.showPopUp('success', 'Downloaded data. Drawing plot...');
                setTimeout(function() {
                    data.data.results.data.forEach(function(entry) {
                        if (entry.prepid.indexOf('ReReco') == -1 && entry.prepid.indexOf('CMSSW') == -1) {
                            entry.url = 'https://cms-pdmv.cern.ch/mcm/requests?prepid=' + entry.prepid
                        } else {
                            entry.url = 'https://cmsweb.cern.ch/reqmgr2/fetch?rid=' + entry.workflow
                        }
                    });
                    Data.setLoadedData(data.data.results.data, false);
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    Data.setInterestedPWGFilter(data.data.results.interested_pwg);
                    Data.setValidTags(data.data.results.valid_tags);
                    $scope.availableStatuses = data.data.results.all_statuses_in_history.slice()
                    if ($scope.availableStatuses.length == 0) {
                        $scope.subtrahend = undefined
                        $scope.minuend = undefined
                    } else {
                        if ($scope.availableStatuses.indexOf($scope.subtrahend) == -1) {
                            $scope.subtrahend = $scope.availableStatuses[0];
                        }
                        if ($scope.availableStatuses.indexOf($scope.minuend) == -1) {
                            $scope.minuend = $scope.availableStatuses[$scope.availableStatuses.length - 1];
                        }
                    }
                    $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
                    $scope.setURL($scope, Data);
                    $scope.$broadcast('onChangeNotification:LoadedData');
                    $scope.messages = data.data.results.messages;
                    $scope.loadingData = false;
                    if (data.data.results.invalid_tags.length > 0) {
                        $scope.showPopUp('warning', 'Nothing was found for ' + data.data.results.invalid_tags.join(', '));
                    }
                }, 100)
            }, function () {
                Data.setLoadedData([]);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                Data.setInterestedPWGFilter({});
                $scope.data = Data.getLoadedData();
                $scope.showPopUp('error', 'Error loading requests');
                $scope.loadingData = false;
            });
        };

        $scope.binSelected = function(selectedBin) {
            $scope.selectedBin = selectedBin.slice().sort($scope.compareSelected);
            $timeout(function(){
                $scope.$apply();
            });
        }

        $scope.minuendChange = function(minuend) {
            $scope.minuend = minuend;
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.subtrahendChange = function(subtrahend) {
            $scope.subtrahend = subtrahend;
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.scaleChange = function(scale) {
            $scope.scale = scale;
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.changeBins = function() {
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.filterByMinuendSubtrahend = function(data, min, max) {
            if (min === undefined || max === undefined || $scope.availableStatuses.indexOf(min) >= $scope.availableStatuses.indexOf(max)) {
                return []
            }
            var newData = []
            for (var i = 0; i < data.length; i++) {
                if (data[i].history !== undefined && data[i].history[min] !== undefined && data[i].history[max] !== undefined) {
                    if (data[i].history[max] - data[i].history[min] < 0) {
                        continue
                    }
                    data[i].diff = data[i].history[max] - data[i].history[min]
                    data[i].min = data[i].history[min]
                    data[i].max = data[i].history[max]
                    newData.push(data[i])
                }
            }
            return newData
        }

        $scope.compareSelected = function(a, b) {
            if (a[$scope.sortSelectedOn] < b[$scope.sortSelectedOn]) {
                return -$scope.sortSelectedOrder;
            } else if (a[$scope.sortSelectedOn] > b[$scope.sortSelectedOn]) {
                return $scope.sortSelectedOrder;
            } else {
                return 0;
            }
        }

        $scope.changeSelectedSort = function(column) {
            if (column == $scope.sortSelectedOn) {
                $scope.sortSelectedOrder *= -1;
            } else {
                $scope.sortSelectedOn = column;
                $scope.sortSelectedOrder = 1;
            }
            $scope.selectedBin = $scope.selectedBin.sort($scope.compareSelected);
            $timeout(function(){
                $scope.$apply();
            });
        }

        $scope.$on('onChangeNotification:InputTags', function () {
            $scope.query()
        })

        $scope.$on('onChangeNotification:ReInit', function () {
            $location.url('/performance')
            $scope.init()
        })

        $scope.takeScreenshot = function (format) {
            var date = new Date()

            if (format === undefined) {
                format = 'svg';
            }

            var plot = (new XMLSerializer()).serializeToString(document.getElementById("plot"))
            plot += '<text transform="translate(10, 620)">Generated: ' + (dateFormat(date, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, 640)">Last update: ' + (dateFormat($scope.lastUpdateTimestamp * 1000, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, 660)">For input: ' + Data.getInputTags().join(', ') + '</text>';

            // viewBox is needed for rsvg convert
            var xml = '<svg viewBox="0 -20 1160 700" font-family="sans-serif" xmlns="http://www.w3.org/2000/svg">' + 
                      plot +
                      '</svg>';
            $http({
                url: 'api/screenshot',
                method: "POST",
                data: {data: xml, ext: format}
            }).then(function (data) {
                window.open(data.data);
                $rootScope.loadingData = false;
            });
        };
    }
]);
