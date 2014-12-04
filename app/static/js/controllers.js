function resultsCtrl($scope, $http){

    $scope.allRequestData=[];

    $scope.requests = {};
    $scope.requests.selections=['prepid', 'priority', 'pwg'];
    $scope.requests.options={grouping:['member_of_campaign'], value:"total_events", stacking:[], coloring:"status" };
    $scope.requests.settings={duration:1000, legend:true, sort:true};
    $scope.requests.radio={'scale':["linear", "log"], 'operation':["sum", "count"]};

    $scope.piecharts = {};
    $scope.piecharts.sum = "total_events";
    $scope.piecharts.fullTerms = ["new", "validation", "defined", "approved", "submitted", "done"];
    $scope.piecharts.compactTerms = ["done", "to do"];
    $scope.piecharts.nestBy = ["member_of_campaign", "status"];
    $scope.piecharts.domain = ["new", "validation", "done" , "approved", "submitted", "nothing", "defined", "to do"];

    $scope.get_stats = function(query, add){
        $scope.loadingData = true;
	var promise = $http.get("search");
      promise.then(function(data){
          if(query!='' && add) {
            data.data.results.push.apply(data.data.results, $scope.allRequestData);
          }
        $scope.loadingData = false;
        $scope.allRequestData = data.data.results;
      }, function(){
        alert("Error getting requests");
        $scope.loadingData = false;
    });
    };
}

