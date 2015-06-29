from subprocess import call

class TakeScreenshotAPI():

    def get(self, svg):
        print "Debug"
        output_file = "/tmp/tmp2.png"
        output_format = "png"
        path = "/tmp/index.svg"
        call(["rsvg-convert", "-o", output_file ,"-f", "output_format",
              "--background-color", "white", path])
        return ""
