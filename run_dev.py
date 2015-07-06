"""pMp development run script
Configuration file in config.py
> sudo python run_dev.py
"""
import config
from pmp import app

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=config.PORT)
