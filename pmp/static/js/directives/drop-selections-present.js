.directive('mcmCustomizableChart', ['$compile', '$http', function($compile, $http) {
        return {
            restrict: 'E',
            scope: {
                linearScale: '=',
                options: '=', // dictionary with all the options for selections (value can be a string (single value) or list (multiple values possible))
                selections: '=', // what can you select from when it comes to single and multi values
                showMode: '@', // show mode radio
                showScale: '@' // show scale radio
            },
            link: function(scope, element, attrs) {

                //init values
                scope.options = scope.options || {};
                scope.optionsHelper = angular.copy(scope.options);
                scope.selections = scope.selections || [];
                scope.selectionsHelper = angular.copy(scope.selections);
                scope.showScale = scope.showScale === "true";
                scope.showMode = scope.showMode === "true";
                scope.radio = {}

                scope.removeOption = function(optionName, optionValue) {
                    scope.$parent.setURL('selections', optionValue);
                    if(scope.options[optionName] instanceof Array) {
                        var index = scope.options[optionName].indexOf(optionValue);
                        if(index > -1) {
                            scope.options[optionName].splice(index, 1);
                        }
                    } else {
                        scope.options[optionName] = "";
                    }
                    scope.$apply();
                };

            scope.changeScale = function () {
                if (!scope.showScale) return null;
                console.log(scope.showScale);
                console.log(typeof(scope.showScale));
                if (scope.linearScale != scope.radio.scale) {
                    scope.linearScale = scope.radio.scale;
                    scope.$parent.changeScale(scope.radio.scale);
                }
            };

                scope.addOption = function(optionName, optionValue, optionIndex) {
                    scope.$parent.setURL(optionName, optionValue);
                    if(scope.options[optionName] instanceof Array) {
                        scope.options[optionName].splice(optionIndex-1, 0, optionValue);
                    } else {
                        scope.options[optionName] = optionValue;
                    }
                    scope.$apply();
                };

                var innerHtml = ""
                $http.get('build/drop-selections.min.html').success(function(html) {
                        innerHtml += html;

                element.append($compile(innerHtml)(scope));

                setTimeout(function () {

                        $("ul.nav.dnd", element).sortable({
                    group: Math.random(), // so it's not possible to move to other groups
                    nested: false,
                    vertical: false,
                    exclude: 'nav-header',
                    title: 'nav-header',
                    pullPlaceholder:false,
                    isValidTarget: function($item, container) {
                        return !($(container.el[0]).hasClass("single") && container.items.length > 0);
                    },
                    onDrop: function($item, container, _super) {
                        if(container.el[0].id!='possible-selections') {
                            scope.addOption(container.el[0].id, $item[0].textContent, $(container.el[0].children).index($item[0]));
                        }
                        _super($item, container);
                        },
                            onDragStart: function($item, container, _super) {
                        if(container.el[0].id!='possible-selections') {
                            scope.removeOption(container.el[0].id, $item[0].textContent);
                        }
                        _super($item, container);
                                }
                            });
                }, 0);
                    });
            }
        }
    }])