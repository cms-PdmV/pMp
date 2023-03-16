"""Change configuration here"""
import os
import secrets
import logging

logger = logging.getLogger()
secret_key = os.getenv("SECRET_KEY")
if not secret_key:
    logger.warning("SECRET_KEY not set, this deployment will generate one for you")
    secret_key = secrets.token_hex()

ADMINS = ["pdmvserv@cern.ch"]
DEBUG = True
# Be aware of the latest slash when you set this environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "http://127.0.0.1:9200/")
HOST = os.getenv("HOST", "127.0.0.1")
HOSTMAIL = os.getenv("HOSTNAME") + "@noreply.com"
PORT = int(os.getenv("PORT", "80"))
SECRET_KEY = secret_key
CACHE_TIMEOUT = int(os.getenv("CACHE_TIMEOUT", "600"))
CACHE_SIZE = int(os.getenv("CACHE_SIZE", "200"))

logger.info("Environment")
logger.info("ADMINS: %s", ADMINS)
logger.info("DEBUG: %s", DEBUG)
logger.info("DATABASE_URL: %s", DATABASE_URL)
logger.info("HOST: %s", HOST)
logger.info("HOSTMAIL: %s", HOSTMAIL)
logger.info("PORT: %s", PORT)
logger.info("CACHE_TIMEOUT: %s", CACHE_TIMEOUT)
logger.info("CACHE_SIZE: %s", CACHE_SIZE)
