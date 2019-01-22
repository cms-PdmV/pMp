/**
 * @name dropSelections.directive
 * @type directive
 * @description Using jquery sortable to have interactive drag&drop option adjustment
 */
.directive('checkboxSelections', ['$compile', '$http', function ($compile, $http) {
    return {
        restrict: 'E',
        scope: {
            options: '=', // dictionary with all the options for selections (value can be a string (single value) or list (multiple values possible))
            selected: '=', // specifies list of unassigned selections
            onValueChange: '='
        },
        templateUrl: 'build/checkbox-selections.min.html',
        link: function (scope, element) {
            scope.selectionChanged = function(selection) {
                scope.selectionDict[selection] = !scope.selectionDict[selection]
                if (scope.onValueChange) {
                    scope.onValueChange(selection)
                }
            }
            scope.$watch('options', function(options) {
                if (options !== undefined) {
                    scope.selectionDict = {}
                    for (var i in options) {
                        scope.selectionDict[i] = i == scope.selected
                    }
                }
            });
            scope.$watch('selected', function(selected) {
                if (selected !== undefined && scope.options !== undefined) {
                    for (var i in scope.options) {
                        scope.selectionDict[i] = selected.includes(i)
                    }
                }
            });
        }
    };
}])

