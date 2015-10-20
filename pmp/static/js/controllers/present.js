/**
 * @name present.controller
 * @type controller
 * @description Present Graph Controller
 */
angular.module('pmpApp').controller('PresentController', ['$http', '$location',
    '$interval', '$rootScope', '$scope', 'PageDetailsProvider', 'Data',
    function ($http, $location, $interval, $rootScope, $scope, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.present;

            // reset data and filters
            Data.reset(true);

            // define piecharts options
            $scope.piecharts = {
                compactTerms: ["done", "to do"],
                domain: ["new", "validation", "done",
                    "approved", "submitted", "nothing",
                    "defined", "to do"
                ],
                fullTerms: ["new", "validation", "defined",
                    "approved", "submitted", "done",
                    "upcoming"
                ],
                nestBy: ["member_of_campaign", "status"],
                sum: "total_events"
            };

            // get graph parameters or set defaults
            if ($location.search().p !== undefined) {
                var toLoad = $location.search().p.split(',');
                $scope.parameters = toLoad.slice(0, 6);
                $scope.radio = toLoad.slice(6, 8);
            } else {
                $scope.parameters = ['1', '0', '3', '0', '0', '0'];
                $scope.radio = ['0', '0'];
            }

            // set requests globals
            $scope.requests = {
                options: {
                    grouping: [],
                    stacking: [],
                    coloring: ""
                },
                selections: [],
                settings: {
                    duration: 1000,
                    legend: true,
                    sort: true
                }
            };

            // assign selections to options
            $scope.options = ['selections', 'grouping', 'stacking',
                'coloring'
            ];
            $scope.selections = ['member_of_campaign',
                'total_events', 'status', 'prepid', 'priority',
                'pwg'
            ];
            for (var i = 0; i < $scope.parameters.length; i++) {
                if ($scope.parameters[i] === '0') {
                    $scope.requests.selections.push($scope.selections[
                        i]);
                } else if ($scope.parameters[i] === '1') {
                    $scope.requests.options.grouping.push($scope.selections[
                        i]);
                } else if ($scope.parameters[i] === '2') {
                    $scope.requests.options.stacking.push($scope.selections[
                        i]);
                } else if ($scope.parameters[i] === '3') {
                    $scope.requests.options.coloring = $scope.selections[
                        i];
                }
            }

            // assign radio values, scale and mode
            if ($scope.radio[1] === "1") {
                $scope.scaleType = "log";
            } else {
                $scope.scaleType = "linear";
            }

            if ($scope.radio[0] === "1") {
                $scope.modeType = "requests";
            } else if ($scope.radio[0] === "2") {
                $scope.modeType = "seconds";
            } else {
                $scope.modeType = "events";
            }

            // if show time label
            $scope.showDate = $location.search().t === 'true';

            // if in growing mode
            $scope.growingMode = $location.search().m === 'true';

            // if in display mode
            $scope.displayChains = $location.search().c === 'true';

            // update mode
            $scope.modeUpdate(true);

            // initiate filters
            if ($location.search().x !== undefined && $location.search()
                .x !== '') Data.setPriorityFilter($location.search()
                .x.split(','));
            if ($location.search().s !== undefined && $location.search()
                .s !== '') Data.initializeFilter($location.search()
                .s.split(','), true);
            if ($location.search().w !== undefined && $location.search()
                .w !== '') Data.initializeFilter($location.search()
                .w.split(','), false);

            // load graph data
            if ($location.search().r !== undefined && $location.search()
                .r !== '') {
                var tmp = $location.search().r.split(',');
                // if filter is empty, assume all true
                var empty = [$scope.isEmpty(Data.getPWGFilter()),
                    $scope.isEmpty(Data.getStatusFilter())
                ];
                for (var j = 0; j < tmp.length; j++) {
                    $scope.load(tmp[j], true, tmp.length, empty[0],
                        empty[1]);
                }
            } else {
                // if this is empty just change URL as some filters
                // could have been initiated
                $scope.setURL();
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
        $scope.load = function (campaign, add, more, defaultPWG,
            defaultStatus) {
            if (!campaign) {
                $scope.showPopUp(PageDetailsProvider.messages.W0.type,
                    PageDetailsProvider.messages.W0.message);
            } else if (add && Data.getInputTags().indexOf(campaign) !==
                -1) {
                $scope.showPopUp(PageDetailsProvider.messages.W1.type,
                    PageDetailsProvider.messages.W1.message);
            } else {
                $rootScope.loadingData = true;
                var promise;
                if ($scope.growingMode) {
                    promise = $http.get("api/" + campaign +
                        "/growing/" + $scope.displayChains);
                } else {
                    promise = $http.get("api/" + campaign +
                        "/announced/" + $scope.displayChains);
                }
                promise.then(function (data) {
                    if (!data.data.results.length) {
                        // if API response is empty 
                        $scope.showPopUp(
                            PageDetailsProvider.messages
                            .W2.type,
                            PageDetailsProvider.messages
                            .W2.message);
                        $scope.setURL();
                        $rootScope.loadingData = false;
                    } else {
                        if (add) {
                            // apply appending campaign
                            Data.changeFilter(data.data.results,
                                false, defaultStatus,
                                true);
                            Data.changeFilter(data.data.results,
                                false, defaultPWG,
                                false);
                            Data.setLoadedData(data.data.results,
                                               true, true, more);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S1.type,
                                PageDetailsProvider.messages
                                .S1.message);
                        } else {
                            // apply loading all or single campaign
                            Data.reset(false);
                            Data.changeFilter(data.data.results,
                                true, true, true);
                            Data.changeFilter(data.data.results,
                                true, true, false);
                            Data.setLoadedData(data.data.results,
                                false, true);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S0.type,
                                PageDetailsProvider.messages
                                .S0.message);
                        }
                        Data.setInputTags(campaign, true,
                            false);
                        $scope.setURL();
                    }
                }, function () {
                    $scope.showPopUp(PageDetailsProvider.messages
                        .E0.type, PageDetailsProvider.messages
                        .E1.message);
                    $rootScope.loadingData = false;
                });
            }
        };

        /**
         * @description Core: Change URL when data or filter changes
         * @param {String} name the name of parameter that has changed
         * @param {Integer} value the position of parameter that has changed
         */
        $scope.setURL = function (name, value) {
            if (name !== undefined && value !== undefined) {
                var i = $scope.options.indexOf(name);
                if (i < 0) i = 0;
                $scope.parameters[$scope.selections.indexOf(value)] = i;
            }

            $location.path($location.path(), false);
            var params = {};

            // collect user inputs
            var r = Data.getInputTags();
            if (r.length) params.r = r.join(',');

            // graph parameters
            params.p = $scope.parameters.join(',') + ',' +
                $scope.radio.join(',');

            // is in growing mode
            params.m = $scope.growingMode + "";

            // is in chain mode
            params.c = $scope.displayChains + "";

            // show time label
            params.t = $scope.showDate + "";

            // set priority filter
            params.x = Data.getPriorityFilter().join(',');

            // init loads differently for no param (all true) and empty param (all false)
            // hence the isEmpty check

            // set pwg filter
            if (!$scope.isEmpty(Data.getPWGFilter())) {
                params.w = $scope.getCSVPerFilter(Data.getPWGFilter());
            }

            // set status filter
            if (!$scope.isEmpty(Data.getStatusFilter())) {
                params.s = $scope.getCSVPerFilter(Data.getStatusFilter());
            }

            // reload url
            $location.search(params);
            // broadcast change notification
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

        /**
         * @description Update mode
         * @param {Boolean} onlyTitle if false, perform API query as well
         */
        $scope.modeUpdate = function (onlyTitle) {
            if ($scope.growingMode) {
                $scope.mode = ': Growing Mode';
            } else {
                $scope.mode = ': Announced Mode';
            }
            if (onlyTitle) {
                return null;
            }
            Data.reloadFilters([]);
            var tmp = Data.getInputTags();
            Data.setInputTags([], false, false);
            if (tmp.length < 2 || !$scope.displayChains) {
                for (var i = 0; i < tmp.length; i++) {
                    $scope.load(tmp[i], true, tmp.length, true,
                        true);
                }
            } else {
                Data.reset(false);
            }
        };

        /**
         * @description When scale has been changed.
         */
        $scope.changeScale = function (type) {
            $scope.scaleType = type;
            $scope.setScaleAndOperation(1, (type === "log") + 0)
        };

        /**
         * @description When scale has been changed.
         */
        $scope.changeMode = function (type) {
            $scope.modeType = type;
            $scope.setScaleAndOperation(0, ['events', 'requests', 'seconds'].indexOf(type));
        };

        $scope.applyDifference = function(values, optionName, optionValue) {
            $scope.requests.options = values;
            $scope.setURL(optionName, optionValue);
        };

        $scope.setScaleAndOperation = function (i, value) {
            if ($scope.radio[i] != value) {
                $scope.radio[i] = value;
                $scope.setURL();
            }
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:FilteredData', function () {
            $scope.setURL();
            $scope.data = Data.getFilteredData();
            $rootScope.loadingData = false;
        });

        // Set interval update of time variables
        var intervalUpdate1 = $interval($scope.updateCurrentDate, 1000);
        var intervalUpdate2 = $interval(function () {
            $scope.updateLastUpdate(
                'campaigns,chained_campaigns,requests,chained_requests'
            );
        }, 2 * 60 * 1000);
        $scope.updateLastUpdate(
            'campaigns,chained_campaigns,requests,chained_requests'
        );
        $scope.$on('$destroy', function () {
            $interval.cancel(intervalUpdate1);
            $interval.cancel(intervalUpdate2);
        });
    }
]);