"""Change configuration here"""
import os
import re
import logging

logger = logging.getLogger()

# Environment variables
ADMINS = ["pdmvserv@cern.ch"]
DEBUG = True if os.getenv("DEBUG") else False
# Be aware of the latest slash when you set this environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "http://127.0.0.1:9200/")
HOST = os.getenv("HOST", "127.0.0.1")
HOSTMAIL = os.getenv("HOSTNAME") + "@noreply.com"
PORT = int(os.getenv("PORT", "80"))
CACHE_TIMEOUT = int(os.getenv("CACHE_TIMEOUT", "600"))
CACHE_SIZE = int(os.getenv("CACHE_SIZE", "200"))
QUERY_TIMEOUT = int(os.getenv("QUERY_TIMEOUT", "15"))

# Enable Opensearch client
OPENSEARCH = True if os.getenv("OPENSEARCH") else False

# Use Kerberos authentication if required
KERBEROS_AUTH = True if os.getenv("KERBEROS_AUTH") else False

# Use Basic authentication if required
BASIC_AUTH = True if os.getenv("BASIC_AUTH") else False


def ca_cert():
    """
    Retrieve the path to the CA certificate used by HTTPS requests to
    Opensearch
    """
    ca_cert = os.getenv("CA_CERT")
    if not ca_cert:
        raise ValueError(
            "CERN CA certificate path not set, please set this value to open the connection"
        )
    return ca_cert


def search_engine_credentials():
    """
    Retrieve the credentials to authenticate to Opensearch
    engine.

    Returns
    ----------
    dict:
        The following keys:
            username: User for authenticate,
            password: User's password,
    """
    user = os.getenv("OPENSEARCH_USER")
    password = os.getenv("OPENSEARCH_PASS")
    if not user:
        raise ValueError("User to authenticate to the search engine has not been set.")
    if not password:
        raise ValueError(
            "User's password to authenticate to the search engine has not been set."
        )
    credentials = {
        "user": user,
        "password": password,
    }
    return credentials


def get_search_engine_host():
    """
    Retrieves the connection URL to the search engine
    If BASIC_AUTH is set, this function will append the credentials into
    the URL to perform a basic authentication.
    """
    search_engine_host = os.getenv("DATABASE_URL", "http://127.0.0.1:9200/")
    if not BASIC_AUTH:
        return search_engine_host

    credentials = search_engine_credentials()
    http_regex = r"http[s]{0,1}://"
    scheme = [s for s in re.findall(http_regex, search_engine_host) if s][0]
    host = [h for h in re.split(http_regex, search_engine_host) if h][0]
    user = credentials["user"]
    password = credentials["password"]

    basic_auth_url = f"{scheme}{user}:{password}@{host}"
    return basic_auth_url


DATABASE_URL = get_search_engine_host()
CA_CERT = ca_cert() if OPENSEARCH else None

logger.info("Environment")
logger.info("ADMINS: %s", ADMINS)
logger.info("DEBUG: %s", DEBUG)
logger.info("DATABASE_URL: %s", DATABASE_URL)
logger.info("HOST: %s", HOST)
logger.info("HOSTMAIL: %s", HOSTMAIL)
logger.info("Using Opensearch instead of Elasticsearch? %s", OPENSEARCH)
