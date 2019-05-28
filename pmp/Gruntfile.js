module.exports = function(grunt) {
 grunt.initConfig({
  concat: {
   js: {
    src: ['static/js/app.js',
          'static/js/filters/array.js',
          'static/js/filters/readable.js',
          'static/js/services/browser.js',
          'static/js/services/data.js',
          'static/js/services/info.js',
          'static/js/controllers/main.js',
          'static/js/controllers/index.js',
          'static/js/controllers/present.js',
          'static/js/controllers/historical.js',
          'static/js/controllers/performance.js',
          'static/js/controllers/filter.js',
          'static/js/controllers/share.js',
          'static/js/controllers/tags.js',
          'static/js/controllers/typeahead.js'],
    dest: 'static/build/pmp.build.min.js'
   },
   js2: {
    src: ['static/js/directives/pmp.js',
          'static/js/directives/radio-selections.js',
          'static/js/directives/checkbox-selections.js',
          'static/js/directives/historical-linear.js',
          'static/js/directives/performance-histogram.js',
          'static/js/directives/present-column.js',
          'static/js/directives/present-donut.js',
          'static/js/directives/present-stats-table.js',
          'static/js/directives/tags.js'
          ],
    dest: 'static/build/directives.pmp.build.js'
   },
   dependjs: {
    src: ['node_modules/jquery/dist/jquery.min.js',
          'node_modules/jquery-sortable/source/js/jquery-sortable-min.js',
          'node_modules/bootstrap/dist/js/bootstrap.min.js',
          'node_modules/angular/angular.min.js',
          'node_modules/angular-animate/angular-animate.min.js',
          'node_modules/angular-route/angular-route.min.js',
          'node_modules/angular-ui-bootstrap/dist/ui-bootstrap-tpls.js',
          'node_modules/d3/dist/d3.min.js',
          'node_modules/clipboard/dist/clipboard.min.js'],
    dest: 'static/build/depend.build.js'
   },
   pmpcss: {
    src: ['static/css/pmp.css',
          'static/css/bootstrap-custom.css'],
    dest: 'static/build/pmp.build.css'
   },
   dependcss: {
    src: ['node_modules/animate.css/animate.min.css',
          'node_modules/bootstrap/dist/css/bootstrap.min.css',
          'node_modules/font-awesome/css/fontawesome.min.css'],
    dest: 'static/build/depend.build.css'
   },
   html: {
    src:['templates/valid.html'],
    dest: 'static/build/valid.prod.html'
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
        'static/build/radio-selections.min.html': 'static/partials/radio-selections.html',
        'static/build/checkbox-selections.min.html': 'static/partials/checkbox-selections.html',
        'static/build/filter.min.html': 'static/partials/filter.html',
        'static/build/historical.min.html': 'static/partials/historical.html',
        'static/build/index.min.html': 'static/partials/index.html',
        'static/build/performance.min.html': 'static/partials/performance.html',
        'static/build/plot.min.html': 'static/partials/plot.html',
        'static/build/present.min.html': 'static/partials/present.html',
        'static/build/share.min.html': 'static/partials/share.html',
        'static/build/present-stats-table.min.html': 'static/partials/present-stats-table.html',
        'static/build/tags.min.html': 'static/partials/tags.html',
        'static/build/valid.min.html': 'static/build/valid.prod.html',
        'static/build/invalid.min.html': 'templates/invalid.html'
      }
    }
  },
  watch: {
   js: {
    files: ['static/js/*/*.js', 'static/js/*.js'],
    tasks: ['concat:js', 'concat:js2']
   },
   css: {
    files: ['static/css/*.css'],
    tasks: ['concat:pmpcss', 'cssmin']
   },
   htmlpartials: {
    files: ['static/partials/*.html'],
    tasks: ['htmlmin']
   },
   htmltemplates: {
    files: ['templates/*.html'],
    tasks: ['concat:html', 'htmlmin']
   }
  }
 });
 grunt.loadNpmTasks('grunt-contrib-concat');
 grunt.loadNpmTasks('grunt-contrib-cssmin');
 grunt.loadNpmTasks('grunt-contrib-htmlmin');
 grunt.loadNpmTasks('grunt-contrib-watch');
 grunt.registerTask('default', ['concat', 'cssmin', 'htmlmin', 'watch'])
};
