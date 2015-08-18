angular.module('pmpApp').controller('ChainsController', ['$http', '$scope',
                                       function($http, $scope) {

        $scope.parseResponse = function(data) {
            var tempNodeArray = [], nodes = [], links = [];
            for (var i = 0; i < data.length; i++) {
                for (var j = 0; j < data[i].campaigns.length; j++) {
                    //add node if it doesn't already exist
                    if ($.inArray(data[i].campaigns[j][0], tempNodeArray) === -1) {
                        tempNodeArray.push(data[i].campaigns[j][0]);
                        nodes.push({"id": data[i].campaigns[j][0]});
                    }
                    if (j !== 0) {  
                        links.push({"source": data[i].campaigns[j - 1][0],
                                    "target": data[i].campaigns[j][0],
                                    "name": data[i].campaigns[j][1]
                                    });
                    }
                }
            }
            return {nodes: nodes, links: links};

        }

        $scope.setListeners = function () {
            var $svg = $('svg');
            
            $svg
            /*.on('dblclick', '.node', function () {
                    var thisData = this.__data__;
                    
                    if (thisData.isExpanded) {
                        graph.reduceNodes(thisData);
                    } else {
                        graph.expandNodes(thisData);
                    }
                    
                    graph.draw();
                    })*/
            .on('mouseover', '.node',function () {
                    $(this).find('.node-text').show();
                })
            .on('mouseleave', '.node',function () {
                    $(this).find('.node-text').hide();
                });
        };
        
        $scope.initChains = function() {
            $scope.title = "Chains Landscape";
            $scope.allRequestData = [];
            $scope.loadingData = true;

            var promise = $http.get("api/_/chain/_");
            promise.then(function(data) {
                $scope.allRequestData = $scope.parseResponse(data.data.results);
                $scope.setListeners();
                $scope.loadingData = false;
            });
        }
    }]);