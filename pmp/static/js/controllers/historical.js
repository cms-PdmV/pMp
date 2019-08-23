/**
 * @name historical.controller
 * @type controller
 * @description Historical Graph Controller
 */
angular.module('pmpApp').controller('HistoricalController', ['$http',
                                                             '$location',
                                                             '$rootScope',
                                                             '$scope',
                                                             '$timeout',
                                                             '$interval',
                                                             'PageDetailsProvider',
                                                             'Data',
    function ($http, $location, $rootScope, $scope, $timeout, $interval, PageDetailsProvider, Data) {
        'use strict';

        /**
         * @description Holds information about parameter defaults
         */
        $scope.defaults = {
            r: '', // search term
            zoomY: false, // zoom on Y axis
            granularity: 250, // granularity value
            humanReadable: true, // human-readable numbers
            showDoneRequestsList: false,
            estimateCompleted: false,
            priority: undefined, // priority filter
            status: undefined, // status filter
            pwg: undefined, // PWG filter
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.historical;

            // reset data and filters
            $scope.loadingData = false;
            Data.reset(true);
            $scope.data = undefined;
            $scope.firstLoad = true;
            $scope.changeActiveIndex(2);

            // collect URL parameters together
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)
            // if zoom on y label
            $scope.zoomY = urlParameters.zoomY === 'true';

            // granularity
            $scope.granularity = parseInt(urlParameters.granularity, 10);

            $scope.humanReadable = urlParameters.humanReadable === 'true';

            $scope.showDoneRequestsList = urlParameters.showDoneRequestsList === 'true';

            $scope.estimateCompleted = urlParameters.estimateCompleted === 'true';

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
            var granularity = $scope.granularity;
            $scope.firstLoad = false;
            var queryUrl = 'api/historical?r=' + inputTags.slice().sort().join(',');
            if (granularity) {
                queryUrl += '&granularity=' + granularity;
            }
            if (priorityQuery !== undefined) {
                queryUrl += '&priority=' + priorityQuery;
            }
            if (statusQuery !== undefined) {
                queryUrl += '&status=' + statusQuery;
            }
            if (pwgQuery !== undefined) {
                queryUrl += '&pwg=' + pwgQuery;
            }
            if ($scope.estimateCompleted) {
                queryUrl += '&estimateCompleted=true';
            }
            // query for linear chart data
            var promise = $http.get(queryUrl);
            promise.then(function (data) {
                $scope.showPopUp('success', 'Downloaded data. Drawing plot...');
                setTimeout(function() {
                    Data.setLoadedData(data.data.results.data, false);
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    Data.setValidTags(data.data.results.valid_tags);
                    $scope.loadTaskChain = false;
                    data.data.results.submitted_requests.forEach(function(entry) {
                        if (entry.prepid.indexOf('ReReco') == -1 && entry.prepid.indexOf('CMSSW') == -1) {
                            entry.url = 'https://cms-pdmv.cern.ch/mcm/requests?prepid=' + entry.prepid
                        } else {
                            entry.url = 'https://cmsweb.cern.ch/reqmgr2/fetch?rid=' + entry.workflow
                        }
                        entry.perc = entry.done / entry.expected * 100;
                    });
                    $scope.listSubmitted = data.data.results.submitted_requests;
                    data.data.results.done_requests.forEach(function(entry) {
                        if (entry.prepid.indexOf('ReReco') == -1 && entry.prepid.indexOf('CMSSW') == -1) {
                            entry.url = 'https://cms-pdmv.cern.ch/mcm/requests?prepid=' + entry.prepid
                        } else {
                            entry.url = 'https://cmsweb.cern.ch/reqmgr2/fetch?rid=' + entry.workflow
                        }
                        entry.perc = entry.done / entry.expected * 100;
                    });
                    $scope.listDone = data.data.results.done_requests
                    $scope.data = Data.getLoadedData();
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
                $scope.data = Data.getLoadedData();
                $scope.showPopUp('error', 'Error loading requests');
                $scope.loadingData = false;
            });
        };

        $scope.changeGranularity = function() {
            $scope.query()
        }

        $scope.changeHumanReadable = function() {
            $scope.setURL($scope, Data);
            if ($scope.data) {
                $scope.data = $scope.data.slice();
            }
        }

        $scope.changeZoomY = function() {
            $scope.setURL($scope, Data);
        }

        $scope.changeShowDoneRequestsList = function() {
            $scope.setURL($scope, Data);
        }

        $scope.changeEstimateCompleted = function() {
            $scope.query();
        }

        $scope.$on('onChangeNotification:InputTags', function () {
            $scope.query()
        })

        $scope.$on('onChangeNotification:ReInit', function () {
            $location.url('/historical')
            $scope.init()
        })

        /**
         * @description Core: Query server for a report of current view
         * @param {String} format which will be requested (pdf/png/svg)
         */
        $scope.takeScreenshot = function (format) {
            $rootScope.loading = true;
            var dataLabel = document.getElementById("historical-drilldown").getElementsByTagName("div")
            // lets get the labels text
            var date = new Date()
            var dataLabelWidth = (1160 - 20)  / dataLabel.length;
            var time_line = '<text x="10" y="15">' + dataLabel[0].textContent + '</text>';
            var expected_evts = '<text x="' + (dataLabelWidth + 10) + '" y="15" style="fill: #263238;">' + dataLabel[1].textContent + '</text>';
            var evts_in_DAS = '<text x="' + (dataLabelWidth * 2 + 10) + '" y="15" style="fill: #ff6f00;">' + dataLabel[2].textContent + '</text>';
            var done_evts_in_DAS = '<text x="' + (dataLabelWidth * 3 + 10) + '" y="15" style="fill: #01579b;">' + dataLabel[3].textContent + '</text>';
            var invalid_evts = '';
            if (dataLabel.length === 5) {
                invalid_evts = '<text x="' + (dataLabelWidth * 4 + 10) + '" y="15" style="fill: red;">' + dataLabel[4].textContent + '</text>';
            }

            if (format === undefined) {
                format = 'svg';
            }

            var plot = (new XMLSerializer()).serializeToString(document.getElementById("plot"))
            plot += '<text transform="translate(10, 520)">Generated: ' + (date.toDateString() + ' ' + date.toLocaleTimeString('en-GB', {timeZoneName: "short"})) + '</text>'
            plot += '<text transform="translate(10, 540)">Last update: ' + $scope.lastUpdate + ' CERN Time</text>'
            plot += '<text transform="translate(10, 560)">For input: ' + Data.getInputTags().join(', ') + '</text>';

            // viewBox is needed for rsvg convert
            var xml = '<svg viewBox="0 -20 1160 600" font-family="sans-serif" xmlns="http://www.w3.org/2000/svg">' + 
                      time_line +
                      expected_evts +
                      evts_in_DAS +
                      done_evts_in_DAS +
                      invalid_evts +
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
