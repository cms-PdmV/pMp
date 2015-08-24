module.exports = function(grunt) {
 grunt.initConfig({
  concat: {
   js: {
    src: ['static/js/app.js',
          'static/js/services/info.js',
          'static/js/services/data.js',
          'static/js/controllers/main.js',
          'static/js/controllers/index.js',
          'static/js/controllers/present.js',
          'static/js/controllers/historical.js',
          'static/js/controllers/performance.js',
          //'static/js/controllers/chains.js',
          'static/js/controllers/filter.js',
          'static/js/controllers/share.js',
          'static/js/controllers/typeahead.js',
          'static/js/services.js'],
    dest: 'static/build/pmp.build.js'
   },
   dependjs: {
    src: ['static/bower_components/jquery/dist/jquery.min.js',
          'static/bower_components/jquery-sortable/source/js/jquery-sortable-min.js',
          'static/bower_components/bootstrap/dist/js/bootstrap.min.js',
          'static/bower_components/angular/angular.min.js',
          'static/bower_components/angular-animate/angular-animate.min.js',
          'static/bower_components/angular-route/angular-route.min.js',
          'static/bower_components/d3/d3.min.js',
          'static/bower_components/angular-bootstrap/ui-bootstrap-tpls.min.js'],
    dest: 'static/build/depend.build.js'
   },
   pmpcss: {
    src: ['static/css/pmp.css'],
    dest: 'static/build/pmp.build.css'
   },
   dependcss: {
    src: ['static/bower_components/animate.css/animate.min.css',
          'static/bower_components/bootstrap/dist/css/bootstrap.min.css'],
    dest: 'static/build/depend.build.css'
   },
   html: {
    src:['templates/valid-head.html',
         'templates/valid.html'],
    dest: 'static/build/valid.prod.html'
   },
   htmldev: {
    src:['templates/valid-head-dev.html',
         'templates/valid.html'],
    dest: 'static/build/valid.dev.html'
   }
  },
  cssmin: {
   options: {
    shorthandCompacting: false,
    roundingPrecision: -1
   },
   target: {
    files: {
     'static/build/pmp.build.min.css': ['static/build/pmp.build.css']
    }
   }
  },
  htmlmin: {
    dist: {
      options: {
        removeComments: true,
        collapseWhitespace: true
      },
      files: {
        'static/build/advanced.min.html': 'static/partials/advanced.html',
        'static/build/chains.min.html': 'static/partials/chains.html',
        'static/build/filter.min.html': 'static/partials/filter.html',
        'static/build/historical.min.html': 'static/partials/historical.html',
        'static/build/index.min.html': 'static/partials/index.html',
        'static/build/performance.min.html': 'static/partials/performance.html',
        'static/build/plot.min.html': 'static/partials/plot.html',
        'static/build/present.min.html': 'static/partials/present.html',
        'static/build/share.min.html': 'static/partials/share.html',
        'static/build/table.min.html': 'static/partials/statustable.html',
        'static/build/tags.min.html': 'static/partials/tags.html',
        'static/build/valid.min.html': 'static/build/valid.prod.html',
        'static/build/invalid.min.html': 'templates/invalid.html'
      }
    }
  },
  uglify: {
   js: {
    src: ['static/build/pmp.build.js'],
    dest: 'static/build/pmp.build.min.js'
   }
  },
  watch: {
   js: {
    files: ['static/js/*/*.js'],
    tasks: ['concat:js', 'uglify:js']
   },
   css: {
    files: ['static/css/*.css'],
    tasks: ['concat:css', 'cssmin']
   },
   htmlpartials: {
    files: ['static/partials/*.html'],
    tasks: ['htmlmin']
   },
   htmltemplates: {
    files: ['templates/*.html'],
    tasks: ['concat:html', 'concat:htmldev', 'htmlmin']
   }
  }
 });
 grunt.loadNpmTasks('grunt-contrib-concat');
 grunt.loadNpmTasks('grunt-contrib-cssmin');
 grunt.loadNpmTasks('grunt-contrib-htmlmin');
 grunt.loadNpmTasks('grunt-contrib-uglify');
 grunt.loadNpmTasks('grunt-contrib-watch');
 grunt.registerTask('default', ['concat', 'cssmin', 'htmlmin', 'uglify', 'watch'])
 /*
  *ToDo: Add charts.js to js watch
  *There are some problems after uglifying
  */
};