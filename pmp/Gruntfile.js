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
   },
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
  uglify: {
   js: {
    src: ['static/build/pmp.build.js'],
    dest: 'static/build/pmp.build.min.js'
   },
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
  },
 });
 grunt.loadNpmTasks('grunt-contrib-concat');
 grunt.loadNpmTasks('grunt-contrib-cssmin');
 grunt.loadNpmTasks('grunt-contrib-uglify');
 grunt.loadNpmTasks('grunt-contrib-watch');
 grunt.registerTask('default', ['concat', 'cssmin', 'uglify', 'watch'])
 /*
  *ToDo: Add htmlmin
  *grunt.loadNpmTasks('grunt-contrib-htmlmin');
  */
 /*
  *ToDo: Add charts.js to js watch
  *There are some problems after uglifying
  */
};