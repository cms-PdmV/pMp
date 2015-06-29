import os
from datetime import datetime
from subprocess import call

class TakeScreenshotAPI():

    def get_time(self):
        return str(datetime.now())

    def is_file(self, check_file):
        return os.path.isfile(check_file) and os.access(check_file, os.R_OK)

    def generate_name(self):
        return '/tmp/pmp_' + self.get_time()

    def get(self, svg_content):
        while True:
            gen_name = self.generate_name()
            svg_file = gen_name + '.svg'
            if not self.is_file(svg_file):
                break

        tmp_file = open(svg_file, 'w')
        tmp_file.write(svg_content.replace('U+0023', '#'))
        tmp_file.close()
        output_file = gen_name + '.png'
        output_format = 'png'

        call(['rsvg-convert', '-o', output_file ,'-f', output_format,
              '--background-color', 'white', svg_file])
        return ""
