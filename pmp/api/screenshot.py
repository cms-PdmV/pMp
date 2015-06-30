import os
from datetime import datetime
from subprocess import call

class TakeScreenshotAPI():

    def __init__(self):
        self.static_dir = 'pmp/static/'

    def get_time(self):
        return str(datetime.now())

    def is_file(self, check_file):
        return os.path.isfile(check_file) and os.access(check_file, os.R_OK)

    def generate_name(self):
        return 'tmp/pmp_' + self.get_time()

    def get(self, svg_content, output_format='png'):
        while True:
            gen_name = self.generate_name()
            svg_file = self.static_dir + gen_name + '.svg'
            if not self.is_file(svg_file):
                break
        tmp_file = open(svg_file, 'w')
        tmp_file.write(svg_content.replace('U+0023', '#'))
        tmp_file.close()
        if output_format != 'svg':
            output_file = self.static_dir + gen_name + '.' + output_format
            call(['rsvg-convert', '-o', output_file ,'-f', output_format,
                  '--background-color', 'white', svg_file])
        return gen_name + '.' + output_format
