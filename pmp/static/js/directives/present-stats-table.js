/**
 * @name dropSelections.directive
 * @type directive
 * @description Using jquery sortable to have interactive drag&drop option adjustment
 */
.directive('presentStatsTable', ['$compile', '$http', function ($compile, $http) {
    return {
        restrict: 'E',
        scope: {
            data: '=',
            mode: '=',
            humanReadableNumbers: '='
        },
        templateUrl: 'build/present-stats-table.min.html',
        link: function (scope, element) {
            scope.tableData = {}

            var prepareData = function(data) {
                var chainedRequests = {}
                var unchainedRequests = {}
                var allRequests = {}
                var emptyDict = {'new': 0, 'validation': 0, 'defined': 0, 'approved': 0, 'submitted': 0, 'done': 0, 'total': 0}
                for (var i in data) {
                    var campaign = data[i].member_of_campaign
                    var status = data[i].status
                    var chained = data[i].is_member_of_chain === 'YES'
                    var amount = 1
                    if (scope.mode == 'events') {
                        amount = data[i].total_events
                    } else if (scope.mode == 'seconds') {
                        amount = data[i].time_event_sum
                    }
                    if (!(campaign in chainedRequests)) {
                        chainedRequests[campaign] = $.extend({}, emptyDict)
                    }
                    if (!(campaign in unchainedRequests)) {
                        unchainedRequests[campaign] = $.extend({}, emptyDict)
                    }
                    if (!(campaign in allRequests)) {
                        allRequests[campaign] = $.extend({}, emptyDict)
                    }
                    if (chained) {
                        chainedRequests[campaign][status] += amount
                        chainedRequests[campaign]['total'] += amount
                    } else {
                        unchainedRequests[campaign][status] += amount
                        unchainedRequests[campaign]['total'] += amount
                    }
                    allRequests[campaign][status] += amount
                    allRequests[campaign]['total'] += amount
                }
                if (Object.keys(allRequests).length > 1) {
                    var chainedTotal = $.extend({}, emptyDict)
                    var unchainedTotal = $.extend({}, emptyDict)
                    var allTotal = $.extend({}, emptyDict)
                    for (var campaign in allRequests) {
                        for (var status in emptyDict) {
                            chainedTotal[status] += chainedRequests[campaign][status]
                            unchainedTotal[status] += unchainedRequests[campaign][status]
                            allTotal[status] += allRequests[campaign][status]
                        }
                    }
                    chainedRequests['All'] = chainedTotal
                    unchainedRequests['All'] = unchainedTotal
                    allRequests['All'] = allTotal
                }
                scope.tableData = {'chained': chainedRequests, 'unchained': unchainedRequests, 'all': allRequests}
            };

            scope.$watch('data', function(data) {
                if (data !== undefined && data.length) {
                    prepareData(data);
                }
            });
        }
    };
}])

