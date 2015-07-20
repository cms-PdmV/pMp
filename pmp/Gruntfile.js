module.exports = function(grunt) {
 grunt.initConfig({
  concat: {
   js: {
    src: ['static/js/app.js', 'static/js/controllers.js'],
    dest: 'static/build/pmp.build.js',
   },
   css: {
    src: ['static/css/pmp.css'],
    dest: 'static/build/pmp.build.css',
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
        'static/build/tags.min.html': 'static/partials/tags.html',
        'static/build/valid.min.html': 'templates/valid.html',
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
    files: ['static/js/*.js'],
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
    tasks: ['htmlmin']
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