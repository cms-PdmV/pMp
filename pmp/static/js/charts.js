// for multi-transitions
function endall(transition, callback) {
                        var n = 0;
                        transition
                            .each(function() { ++n; })
                            .each("end", function() { if (!--n) callback.apply(this, arguments); });
      }