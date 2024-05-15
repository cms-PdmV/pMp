"""Change configuration here"""
import os
import logging

logger = logging.getLogger()

# Environment variables
ADMINS = ["pdmvserv@cern.ch"]
DEBUG = True if os.getenv("DEBUG") else False
HOST = os.getenv("HOST", "127.0.0.1")
HOSTMAIL = os.getenv("HOSTNAME") + "@noreply.com"
PORT = int(os.getenv("PORT", "80"))
CACHE_TIMEOUT = int(os.getenv("CACHE_TIMEOUT", "600"))
CACHE_SIZE = int(os.getenv("CACHE_SIZE", "200"))
QUERY_TIMEOUT = int(os.getenv("QUERY_TIMEOUT", "15"))

logger.info("Environment")
logger.info("ADMINS: %s", ADMINS)
logger.info("DEBUG: %s", DEBUG)
logger.info("HOST: %s", HOST)
logger.info("HOSTMAIL: %s", HOSTMAIL)
