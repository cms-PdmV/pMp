"""Init pMp Flask app"""
import os
import sys

from flask import Flask, render_template

app = Flask(__name__, static_url_path='')
app.config.from_object('config')


@app.errorhandler(404)
def page_not_found(error):
    """Return invalid template"""
    return (str(error) + render_template('invalid.html')), 404

import pmp.views
