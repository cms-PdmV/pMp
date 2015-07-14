module.exports = function(grunt) {
 grunt.initConfig({
         concat: {
             dist: {
                 src: ['static/js/app.js', 'static/js/controllers.js', 'static/js/charts.js'],
                 dest: 'static/js/pmp.build.min.js',
             },
         },
     });
 
 grunt.loadNpmTasks('grunt-contrib-concat')
};