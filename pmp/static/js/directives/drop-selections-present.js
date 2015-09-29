    .directive('mcmCustomizableChart', ['$compile', function($compile) {
        return {
            restrict: 'E',
            scope: {
                chartType:'=', // html tag
                chartData: '=', // data to transfer to chart (as data='chartData')
                title: '@chartTitle', // title of customizable chart (above everything)
                selections: '=?', // what can you select from when it comes to single and multi values
                options: '=?', // dictionary with all the options for selections (value can be a string (single value) or list (multiple values possible))
                priorityMarkup: '=?', // highlight priority blocks
                radio: '=?', // dictionary of radio-button based selections for finer tuning (value is a list, first element is the default one)
                settings: '=?' // dictionary of other settings for the chart (not customizable by UI)
            },
            link: function(scope, element, attrs) {
                scope.selections = scope.selections || [];
                scope.radio = scope.radio || {};
                scope.options = scope.options || {};
                scope.settings = scope.settings || {};

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

                scope.addOption = function(optionName, optionValue, optionIndex) {
                    scope.$parent.setURL(optionName, optionValue);
                    if(scope.options[optionName] instanceof Array) {
                        scope.options[optionName].splice(optionIndex-1, 0, optionValue);
                    } else {
                        scope.options[optionName] = optionValue;
                    }
                    scope.$apply();
                };

                var innerHtml = "<style>.nav.dnd {margin-bottom: 0;}</style>";
                //innerHtml += "<div class='row' align='middle'><h4>{{title}}</h4></div>";
                innerHtml += "<div class='row'><div class='col-lg-12 col-md-12 col-sm-12 col-xs-12' style='margin-bottom: 3px'><span class='col-lg-2 col-md-2 col-sm-2 col-xs-4 nav-header text-muted'>selections</span>";

                innerHtml += "<ul id='possible-selections' class='nav nav-pills dnd col-lg-10 col-md-10 col-sm-10 col-xs-8 inline' style='min-height:22px'>";
                innerHtml += "<li class='btn btn-default btn-xs text-uppercase' ng-repeat='value in selections'>{{value}}</li>";
                innerHtml += "</ul></div>";
                // options for drag and drop
                for(var key in scope.options) {
                    var value = scope.options[key];
                    if(value instanceof Array) {
                        innerHtml += "<div class='col-lg-6 col-md-6 col-sm-6 col-xs-12'><span class='col-lg-4 col-md-4 col-sm-4 col-xs-4 nav-header' style='margin-bottom: 3px'>"+key+"</span>";
                        innerHtml += "<ul id='"+key+"' class='nav nav-pills dnd col-lg-8 col-md-8 col-sm-8 col-xs-8 inline alert-info' style='min-height:23px; margin-top:1px'>";
                        for(var i=0;i<value.length;i++) {
                            innerHtml+="<li class='btn btn-default btn-xs text-uppercase'>"+value[i]+"</li>";
                        }
                        innerHtml+="</ul></div>";
                    } else {
                        innerHtml += "<div class='col-lg-6 col-md-6 col-sm-6'><span class='col-lg-4 col-md-4 col-sm-4 col-xs-4 nav-header' style='margin-bottom: 3px'>"+key+"</span>";
                        innerHtml+="<ul id='"+key+"' class='nav nav-pills dnd single col-lg-8 col-md-8 col-sm-8 col-xs-8 inline alert-info' style='min-height:23px; margin-top:1px'>";
                        if(value!="") {
                            innerHtml+="<li class='btn btn-default btn-xs text-uppercase'>" + value + "</li>";
                        }
                        innerHtml+="</ul></div>";
                    }
                }
                innerHtml +="</div>";
                innerHtml += "<div class='row' >";
                // radio buttons
                scope.radiovalue = {};
                for(key in scope.radio) {

                    innerHtml += "<div class='col-lg-6 col-md-6 col-sm-6 col-xs-12 spacing-sm' style='margin-top:3px;'>";
                    innerHtml += "<span class='col-lg-4 col-md-4 col-sm-4 col-xs-4 nav-header'>" + key + "</span>";

                    innerHtml += "<ul class='nav nav-pills inline col-lg-8 col-md-8 col-sm-8 col-xs-8'>";
                    scope.radiovalue[key] = scope.radio[key][0];
                    innerHtml += "<li>";

                    innerHtml += "<div class='btn-group'>";
                    innerHtml += "<button ng-repeat='value in radio." + key + "' type='button' class='btn btn-primary btn-xs text-uppercase' ng-model='radiovalue." + key + "' btn-radio='value'>{{value}}</button>";
                    innerHtml += "</div>";
//                    innerHtml +="<select style='height:24px' class='btn btn-defualt btn-xs col-lg-2 col-md-2' ng-model='radio"+key+"' ng-options='v for v in radio[\"" + key + "\"]'></select>";
                    innerHtml +="</li>";
                    innerHtml +="</ul></div>";

                }
                innerHtml +="</div>";


                innerHtml += "<" + scope.chartType + " priority-markup='priorityMarkup' data='chartData' ";
                // concatenate radio and options
                for(key in scope.options) {
                    innerHtml += key + "='options[\""+key+"\"]' ";
                }
                for(key in scope.settings) {
                    innerHtml += key + "='settings[\""+key+"\"]' ";
                }
                for(key in scope.radio) {
                    innerHtml += key + "='radiovalue[\""+key+"\"]' ";
                }
                innerHtml += "></" + scope.chartType + ">";

                var chart = $compile(innerHtml)(scope);
                element.append(chart);

                var group_rand = Math.random(); // so it's not possible to move to other groups

                $("ul.nav.dnd", element).sortable({
                    group: group_rand,
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

            }
        }
    }])