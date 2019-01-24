/**
 * @name present.controller
 * @type controller
 * @description Present Graph Controller
 */
angular.module('pmpApp').controller('PresentController', ['$http', '$location',
    '$interval', '$rootScope', '$scope', '$timeout', 'PageDetailsProvider', 'Data',
    function ($http, $location, $interval, $rootScope, $scope, $timeout, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description stores defaults for URL parameters
         */
        $scope.defaults = {
            r: '', // query value (from search box)
            growingMode: false, // growing mode (boolean)
            chainedMode: false, // chained mode (boolean)
            humanReadable: true, // show human-readable numbers (boolean)
            priority: undefined, // priority filter
            pwg: undefined, // PWG filter
            status: undefined, // status filter
            scale: 'linear',
            mode: 'requests',
            groupBy: 'member_of_campaign',
            colorBy: 'status',
            stackBy: ''
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.present;

            // reset data and filters
            Data.reset(true);

            // collect URL parameters and fill in defaults where necessary
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)

            // enable growing mode?
            $scope.growingMode = urlParameters.growingMode === 'true';

            // enable chained mode?
            $scope.chainedMode = urlParameters.chainedMode === 'true';

            // show human-readable numbers?
            $scope.humanReadable = urlParameters.humanReadable === 'true';

            $scope.availableScales = ['linear', 'log']

            $scope.availableModes = ['events', 'requests', 'seconds']

            $scope.scale = urlParameters.scale;

            $scope.mode = urlParameters.mode;

            $scope.availableSelections = {'member_of_campaign': 'Campaign',
                                          'total_events': 'Total Events',
                                          'prepid': 'Prepid',
                                          'status': 'Status',
                                          'priority': 'Priority',
                                          'is_member_of_chain': 'In chain',
                                          'pwg': 'PWG'}

            $scope.groupBy = urlParameters.groupBy.split(',').filter(e => e.length > 0)
            $scope.colorBy = urlParameters.colorBy.split(',').filter(e => e.length > 0)
            $scope.stackBy = urlParameters.stackBy.split(',').filter(e => e.length > 0)

            // initialise filters
            if (urlParameters.priority !== undefined) {
                Data.setPriorityFilter(urlParameters.priority.split(','));
            }

            if (urlParameters.status !== undefined) {
                var s = {}
                var tmp = urlParameters.status.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    s[tmp] = true;
                }
                Data.setStatusFilter(s);
            }

            if (urlParameters.pwg !== undefined) {
                var w = {}
                var tmp = urlParameters.pwg.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    w[tmp] = true;
                }
                Data.setPWGFilter(w);
            }

            // load graph data
            if (urlParameters.r !== '') {
                var tmp = urlParameters.r.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    Data.addInputTag(tmp[i]);
                }
                $scope.query();
            }
        };

        /**
         * @description Core: Query API
         * @param {String} request User input.
         * @param {Boolean} add Append results if true
         * @param {Boolean} more Are there more requests in a queue
         * @param {Boolean} defaultPWG When new PWG shows up what should be default filter value
         * @param {Boolean} defaultStatus When new status shows up what should be default filter value
         */
        $scope.load = function (request, add, more, defaultPWG, defaultStatus) {
            console.log('request ' + request + ' | add ' + add + ' | more ' + more + ' | defaultPWG ' + defaultPWG + ' | defaultStatus ' + defaultStatus)
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
                $rootScope.loadingData = true;
                if (!add) {
                    // Reset data and filters
                    Data.reset(true);
                }
                Data.addInputTag(request);
                $scope.query(true);
            }
        };

        /**
         * @description Core: Parse filters to query API
         * @param {Boolean} filter If filter data is present.
         */
        $scope.query = function () {
            var inputTags = Data.getInputTags();
            if (inputTags.length === 0) {
                Data.setLoadedData([]);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                $scope.$broadcast('onChangeNotification:LoadedData', {
                    update: false
                });
                return null;
            }

            $rootScope.loadingData = true;
            var priorityQuery = Data.getPriorityQuery();
            var statusQuery = Data.getStatusQuery();
            var pwgQuery = Data.getPWGQuery();
            var queryUrl = 'api/present?r=' + inputTags.join(',');
            if (priorityQuery) {
                queryUrl += '&priority=' + priorityQuery;
            }
            if (statusQuery) {
                queryUrl += '&status=' + statusQuery;
            }
            if (pwgQuery) {
                queryUrl += '&pwg=' + pwgQuery;
            }
            // query for linear chart data
            console.log('Query ' + queryUrl);
            var promise = $http.get(queryUrl);
            promise.then(function (data) {
                Data.setLoadedData(data.data.results.data, false);
                Data.setStatusFilter(data.data.results.status);
                Data.setPWGFilter(data.data.results.pwg);
                $scope.$broadcast('onChangeNotification:LoadedData', {
                    update: false
                });
                $rootScope.loadingData = false;
                $scope.data = Data.getLoadedData();
                $scope.setURL();
            }, function () {
                $scope.showPopUp(PageDetailsProvider.messages
                    .E1.type, PageDetailsProvider.messages
                    .E1.message);
                $rootScope.loadingData = false;
            });
        };

        /**
         * @description Core: Change URL when data or filter changes
         */
        $scope.setURL = function () {
            $location.path($location.path(), false);
            var params = $scope.constructURLQuery($scope, Data)
            $location.search(params);
            $scope.$broadcast('onChangeNotification:URL');
        };

        /**
         * @description Core: Query server for a report of current view
         * @param {String} format which will be requested (pdf/png/svg)
         */
        $scope.takeScreenshot = function (format) {
            $rootScope.loadingData = true;
            if (format === undefined) format = 'svg';
            var xml = (new XMLSerializer()).serializeToString(
                document.getElementById("ctn").getElementsByTagName(
                    "svg")[0]).replace('viewBox="0 0 1125 434"',
                'viewBox="0 0 1125 534" font-family="sans-serif"'
            ).replace('</svg>',
                '<text transform="translate(0, 434)">Generated: ' +
                $scope.dt + '. For input: ' + Data.getInputTags()
                .join(', ') + '</text></svg>').replace(/\n/g, ' ');
            $http({
                url: 'ts',
                method: "POST",
                data: {data: xml, ext: format}
            }).then(function (data) {
                window.open(data.data);
                $rootScope.loadingData = false;
            });
        };

        $scope.modeChange = function(mode) {
            $scope.mode = mode;
            $scope.setURL();
            $scope.data = $scope.data.slice()
        }

        $scope.scaleChange = function(scale) {
            $scope.scale = scale;
            $scope.setURL();
            $scope.data = $scope.data.slice()
        }

        $scope.groupByChange = function(groupBy) {
            $scope.colorBy = $scope.colorBy.filter(e => e !== groupBy && e.length > 0);
            $scope.stackBy = $scope.stackBy.filter(e => e !== groupBy && e.length > 0);
            if ($scope.groupBy.includes(groupBy)) {
                $scope.groupBy = $scope.groupBy.filter(e => e !== groupBy && e.length > 0);
            } else {
                $scope.groupBy.push(groupBy);
            }
            $scope.groupBy = $scope.groupBy.slice()
            $scope.setURL();
            $scope.data = $scope.data.slice()
        }

        $scope.colorByChange = function(colorBy) {
            $scope.groupBy = $scope.groupBy.filter(e => e !== colorBy && e.length > 0);
            $scope.stackBy = $scope.stackBy.filter(e => e !== colorBy && e.length > 0);
            if ($scope.colorBy.includes(colorBy)) {
                $scope.colorBy = [];
            } else {
                $scope.colorBy = [colorBy];
            }
            $scope.colorBy = $scope.colorBy.slice()
            $scope.setURL();
            $scope.data = $scope.data.slice()
        }

        $scope.stackByChange = function(stackBy) {
            $scope.groupBy = $scope.groupBy.filter(e => e !== stackBy && e.length > 0);
            $scope.colorBy = $scope.colorBy.filter(e => e !== stackBy && e.length > 0);
            if ($scope.stackBy.includes(stackBy)) {
                $scope.stackBy = $scope.stackBy.filter(e => e !== stackBy && e.length > 0);
            } else {
                $scope.stackBy.push(stackBy);
            }
            $scope.stackBy = $scope.stackBy.slice()
            $scope.setURL();
            $scope.data = $scope.data.slice()
        }

        $scope.binSelected = function(selectedBin) {
            $scope.selectedBin = selectedBin.slice();
            $timeout(function(){
                $scope.$apply();
            });
        }
    }
]);
