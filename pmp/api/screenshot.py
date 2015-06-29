from subprocess import call

class TakeScreenshotAPI():

    def get(self, svg):
        print "Debug"
        svg_to_file = "/tmp/index2.svg"
        tmp_file = open(svg_to_file, "w")
        tmp_file.write(svg.replace('U+0023', '#'))
        tmp_file.close()

        output_file = "/tmp/tmp2.png"
        output_format = "png"
        call(["rsvg-convert", "-o", output_file ,"-f", "output_format",
              "--background-color", "white", svg_to_file])
        return ""
