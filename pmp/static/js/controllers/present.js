/**
 * @name present.controller
 * @type controller
 * @description Present Graph Controller
 */
angular.module('pmpApp').controller('PresentController', ['$http', '$location',
    '$interval', '$scope', 'PageDetailsProvider', 'Data',
    function ($http, $location, $interval, $scope, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            $scope.page = PageDetailsProvider.present;
            Data.reset(true);

            $scope.graphParam = ['selections', 'grouping',
                'stacking', 'coloring'
            ];
            $scope.graphTabs = ['member_of_campaign',
                'total_events', 'status', 'prepid', 'priority',
                'pwg'
            ];

            $scope.piecharts = {};
            $scope.piecharts.compactTerms = ["done", "to do"];
            $scope.piecharts.domain = ["new", "validation", "done",
                "approved", "submitted", "nothing", "defined",
                "to do"
            ];
            $scope.piecharts.fullTerms = ["new", "validation",
                "defined", "approved", "submitted", "done",
                "upcoming"
            ];
            $scope.piecharts.nestBy = ["member_of_campaign",
                "status"
            ];
            $scope.piecharts.sum = "total_events";

            $scope.aOptionsValues = [1, 0, 3, 0, 0, 0];
            $scope.aRadioValues = [0, 0];

            if ($location.search().p !== undefined) {
                var toLoad = $location.search().p.split(',');
                $scope.aOptionsValues = toLoad.slice(0, 6);
                $scope.aRadioValues = toLoad.slice(6, 8);
            }

            $scope.requests = {};
            $scope.requests.settings = {
                duration: 1000,
                legend: true,
                sort: true
            };
            $scope.requests.selections = [];
            var initGrouping = [];
            var initStacking = [];
            var initColoring = '';
            for (var i = 0; i < $scope.aOptionsValues.length; i++) {
                if ($scope.aOptionsValues[i] === 0) {
                    $scope.requests.selections.push($scope.graphTabs[
                        i]);
                } else if ($scope.aOptionsValues[i] == 1) {
                    initGrouping.push($scope.graphTabs[i]);
                } else if ($scope.aOptionsValues[i] == 2) {
                    initStacking.push($scope.graphTabs[i]);
                } else if ($scope.aOptionsValues[i] == 3) {
                    initColoring = $scope.graphTabs[i];
                }
            }
            $scope.requests.options = {
                grouping: initGrouping,
                stacking: initStacking,
                coloring: initColoring
            };
            $scope.requests.radio = {};
            $scope.requests.radio.scale = ["linear", "log"];
            $scope.requests.radio.mode = ['events', 'requests',
                'seconds'
            ];
            if ($scope.aRadioValues[1] == 1) {
                $scope.requests.radio.scale = ["log", "linear"];
            }
            if ($scope.aRadioValues[0] == 1) {
                $scope.requests.radio.mode = ['requests', 'events',
                    'seconds'
                ];
            }
            if ($scope.aRadioValues[0] == 2) {
                $scope.requests.radio.mode = ['seconds', 'events',
                    'requests'
                ];
            }

            $scope.showDate = $location.search().t === 'true';
            $scope.growingMode = ($location.search().m === 'true');
            $scope.displayChains = ($location.search().c === 'true');
            $scope.modeUpdate(true);

            if ($location.search().x !== undefined && $location.search()
                .x !== '') Data.setPriorityFilter($location.search()
                .x.split(','));
            if ($location.search().s !== undefined && $location.search()
                .s !== '') Data.initializeFilter($location.search()
                .s.split(','), true);
            if ($location.search().w !== undefined && $location.search()
                .w !== '') Data.initializeFilter($location.search()
                .w.split(','), false);

            //initiate from URL
            if ($location.search().r !== undefined) {
                $scope.loadingData = true;
                var tmp = $location.search().r.split(',');
                var empty = [$scope.isEmpty(Data.getPWGFilter()),
                    $scope.isEmpty(Data.getStatusFilter())
                ];
                for (var j = 0; j < tmp.length; j++) {
                    $scope.load(tmp[j], true, tmp.length, empty[0],
                        empty[1]);
                }
            } else {
                $scope.$broadcast('updateURL');
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
                $scope.loadingData = true;
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
                        $scope.loadingData = false;
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
                                true);
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
                                false);
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
                    $scope.loadingData = false;
                });
            }
        };

        /**
         * @description Core: Change URL when data or filter changes
         * @param {String} name the name of parameter that has changed
         * @param {Integer} value the position of parameter that has changed
         */
        $scope.setURL = function (name, value) {
            $location.path($location.path(), false);
            if (typeof name !== undefined && typeof value !==
                undefined) {
                $scope.aOptionsValues[$scope.graphTabs.indexOf(
                    value)] = $scope.graphParam.indexOf(name);
            }
            var params = {};
            var r = Data.getInputTags();
            if (r.length) params.r = r.join(',');
            params.p = $scope.aOptionsValues.join(',') + ',' +
                $scope.aRadioValues.join(',');
            params.t = $scope.showDate + "";
            params.m = $scope.growingMode + "";
            params.c = $scope.displayChains + "";
            params.x = Data.getPriorityFilter().join(',');

            if (!$scope.isEmpty(Data.getPWGFilter())) {
                var w = [];
                for (var i in Data.getPWGFilter()) {
                    if (Data.getPWGFilter()[i]) w.push(i);
                }
                params.w = w.join(',');
            }
            if (!$scope.isEmpty(Data.getStatusFilter())) {
                var s = [];
                for (var j in Data.getStatusFilter()) {
                    if (Data.getStatusFilter()[j]) s.push(j);
                }
                params.s = s.join(',');
            }

            $location.search(params);
            $scope.$broadcast('updateURL');
        };

        /**
         * @description Core: Query server for a report of current view
         * @param {String} format which will be requested (pdf/png/svg)
         */
        $scope.takeScreenshot = function (format) {
            $scope.loadingData = true;
            if (format === undefined) format = 'svg';
            var xml = (new XMLSerializer()).serializeToString(
                document.getElementById("ctn").getElementsByTagName(
                    "svg")[0]).replace(/#/g, 'U+0023').replace(
                /\n/g, ' ').replace(/\//g, '\\\\');
            $http.get('ts/' + format + '/' + encodeURIComponent(xml))
                .then(function (data) {
                    window.open(data.data);
                    $scope.loadingData = false;
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
            Data.setLoadedData([], false);
            if (onlyTitle) {
                return null;
            }
            var tmp = Data.getInputTags();
            Data.setInputTags([], false, false);
            if (tmp.length < 2 || !$scope.displayChains) {
                for (var i = 0; i < tmp.length; i++) {
                    $scope.load(tmp[i], true, tmp.length);
                }
            } else {
                Data.reset(false);
            }
        };

        /**
         * @description When scale has been changed
         */
        $scope.setScaleAndOperation = function (i, value) {
            if ($scope.aRadioValues[i] != value) {
                $scope.aRadioValues[i] = value;
                $scope.setURL();
            }
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:FilteredData', function () {
            $scope.loadingData = false;
            $scope.setURL();
            $scope.data = Data.getFilteredData();
        });

        // Set interval update of time variables
        $interval($scope.updateCurrentDate, 1000);
        $interval(function () {
            $scope.updateLastUpdate(
                'campaigns,chained_campaigns,requests,chained_requests'
            );
        }, 2 * 60 * 1000);
        $scope.updateLastUpdate(
            'campaigns,chained_campaigns,requests,chained_requests'
        );
    }
]);