"""
Builder to instantiate a connector to the Search Engine
This class supports Opensearch and Elasticsearch connectors
"""
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_gssapi import HTTPSPNEGOAuth, OPTIONAL
from elasticsearch import Elasticsearch
import os
import logging
import re


class SearchEngine:
    """
    This module provides a wrapper for creating a Search Engine client: Opensearch or Elasticsearch
    as required

    Attributes:
        client (opensearchpy.OpenSearch | elasticsearch.Elasticsearch): Search engine client
    """

    OPENSEARCH = "OPENSEARCH"
    ELASTICSEARCH = "ELASTICSEARCH"
    __AVAILABLE_ENGINES = {OPENSEARCH: OpenSearch, ELASTICSEARCH: Elasticsearch}

    def __init__(self):
        self.__logger = self.__get_logger()
        (
            self.__requested_engine,
            self.__requested_engine_client,
        ) = self.__determine_search_engine()
        self.__database_url = self.__get_search_engine_url()
        self.__engine: OpenSearch | Elasticsearch = self.__create_engine_client()

    @property
    def client(self):
        return self.__engine

    @property
    def ca_cert(self):
        return self.__get_ca_cert_path()

    @property
    def kerberos(self):
        return self.__require_kerberos_authentication()

    @property
    def url(self):
        return self.__database_url

    def engine_instance_of(self, engine_name: str) -> bool:
        """
        Determines whether the search engine client is an instance of the client described by parameter

        Args:
            engine_name: The name of the search engine we want to check
        """
        if (
            self.__requested_engine == engine_name
            and self.__requested_engine_client
            == SearchEngine.__AVAILABLE_ENGINES.get(engine_name)
        ):
            return True
        return False

    def __get_logger(self) -> logging.Logger:
        """
        Instantiates a logger for the SearchEngine class

        Returns:
            logging.Logger to log all the events related to the SearchEngine class
        """
        logger_format: logging.Formatter = logging.Formatter(
            "[%(levelname)s][%(className)s][%(asctime)s]: %(message)s"
        )
        logger = logging.getLogger("SearchEngine")
        logger_handler = logging.StreamHandler()
        logger_handler.setLevel(logging.DEBUG)
        logger_handler.setFormatter(logger_format)
        logger.addHandler(logger_handler)
        return logger

    def __build_basic_auth_url(
        self, database_url: str, username: str, password: str
    ) -> str:
        """
        Appends the username and password into the connection URL

        Args:
            database_url: Connection URL to the search engine
            username: Basic authentication username
            password: Basic authentication password
        """
        http_regex = r"http[s]{0,1}://"
        scheme = [s for s in re.findall(http_regex, database_url) if s][0]
        host = [h for h in re.split(http_regex, database_url) if h][0]
        basic_auth_url = f"{scheme}{username}:{password}@{host}"
        return basic_auth_url

    def __determine_search_engine(self) -> tuple[str, OpenSearch | Elasticsearch]:
        """
        Determine the client required to be instantiated using
        the configuration provided via the environment variable: SEARCH_ENGINE

        Returns:
           The search engine client identifier and a Opensearch client or Elasticsearch client as requested. A NotImplemented
           error will be raise if the requested search engine is not listed as available.
           A ValueError will be raised if the environment variable is empty.
        """
        search_engine: str = os.getenv("SEARCH_ENGINE")
        if not search_engine:
            raise ValueError(
                f"No search engine specified. Please set an available engine. Available search engines: {SearchEngine.__AVAILABLE_ENGINES}"
            )
        search_engine_client = SearchEngine.__AVAILABLE_ENGINES.get(search_engine)
        if not search_engine_client:
            raise NotImplementedError(
                f"The search client requested: '{search_engine}' is not available. Available search engines: {SearchEngine.__AVAILABLE_ENGINES}"
            )

        self.__logger.info(
            "Search engine chosen: %s, client: %s", search_engine, search_engine_client
        )
        return search_engine, search_engine_client

    def __get_search_engine_url(self) -> str:
        """
        Returns the connection url to the search engine.
        This URL must be provided via the environment variable: DATABASE_URL
        If the environment variable is not provided, a ValueError will be raised
        """
        database_url: str = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError(
                "No database URL was provided via environment variable: DATABASE_URL"
            )
        self.__logger.info("Search engine URL: %s", database_url)
        return database_url

    def __get_ca_cert_path(self) -> str:
        """
        Returns CA certification location required to instantiate the Opensearch client.
        This path must be provided via the environment variable: CA_CERT
        If the environment variable is not provided, a ValueError will be raised
        """
        ca_cert: str = os.getenv("CA_CERT")
        if not ca_cert:
            raise ValueError(
                "CERN CA certificate location was provided via environment variable: CA_CERT"
            )
        self.__logger.info("CERN CA certificate location: %s", ca_cert)
        return ca_cert

    def __get_basic_auth_username(self) -> str:
        """
        Returns the username to perform basic authentication.
        This value must be provided via the environment variable: BASIC_AUTH_USERNAME
        If the environment variable is not provided, a ValueError will be raised
        """
        basic_auth_username: str = os.getenv("BASIC_AUTH_USERNAME")
        if not basic_auth_username:
            raise ValueError(
                "No username was provided to perform basic authentication. Please provide the username via environment variable: BASIC_AUTH_USERNAME"
            )
        return basic_auth_username

    def __get_basic_auth_username(self) -> str:
        """
        Returns the username to perform basic authentication.
        This value must be provided via the environment variable: BASIC_AUTH_USERNAME
        If the environment variable is not provided, a ValueError will be raised
        """
        basic_auth_username: str = os.getenv("BASIC_AUTH_USERNAME")
        if not basic_auth_username:
            raise ValueError(
                "No username was provided to perform basic authentication. Please provide the username via environment variable: BASIC_AUTH_USERNAME"
            )
        self.__logger.info("Basic authentication username set")
        return basic_auth_username

    def __get_basic_auth_password(self) -> str:
        """
        Returns the password to perform basic authentication.
        This value must be provided via the environment variable: BASIC_AUTH_PASSWORD
        If the environment variable is not provided, a ValueError will be raised
        """
        basic_auth_password: str = os.getenv("BASIC_AUTH_PASSWORD")
        if not basic_auth_password:
            raise ValueError(
                "No password was provided to perform basic authentication. Please provide the password via environment variable: BASIC_AUTH_PASSWORD"
            )
        self.__logger.info("Basic authentication password set")
        return basic_auth_password

    def __require_kerberos_authentication(self) -> bool:
        """
        Determines if Kerberos is required to instantiate the search client
        To enable it, please set a value into the environment variable: REQUIRE_KERBEROS
        Returns True if REQUIRE_KERBEROS is set, False otherwise
        """
        requires_kerberos = os.getenv("REQUIRE_KERBEROS")
        using_kerberos = True if requires_kerberos else False
        self.__logger.info("Using Kerberos for authentication: %s", using_kerberos)
        return using_kerberos

    def __create_opensearch_client(
        self,
        database_url: str,
        ca_cert: str,
        kerberos_auth: bool,
    ) -> OpenSearch:
        """
        Instantiates a client to connect to a Opensearch cluster

        Args:
            database_url: Connection URL to the search engine
            ca_cert: Path to the CERN CA certificate to authenticate against Opensearch cluster
            kerberos_auth: Whether to use a Kerberos ticket for authentication against Opensearch cluster
                           by default is is set to False, this implies Basic authentication is going to be used
            basic_auth_user: Username for basic authentication
            basic_auth_pass: Password for basic authentication

        Returns:
            opensearchpy.Opensearch client to connect to Opensearch cluster
        """
        if kerberos_auth:
            self.__logger.info("Using Kerberos authentication for Opensearch client")
            self.__logger.info("Make sure to have access to a granting ticket")
            return OpenSearch(
                hosts=[database_url],
                use_ssl=True,
                verify_cert=True,
                ca_certs=ca_cert,
                connection_class=RequestsHttpConnection,
                http_auth=HTTPSPNEGOAuth(mutual_authentication=OPTIONAL),
            )
        else:
            self.__logger.info("Creating OpenSearch client using Basic Authentication")
            basic_auth_user = self.__get_basic_auth_username()
            basic_auth_pass = self.__get_basic_auth_password()

            database_url_basic_auth: str = self.__build_basic_auth_url(
                database_url=database_url,
                username=basic_auth_user,
                password=basic_auth_pass,
            )
            self.__logger.info(
                "Overwriting Search Engine connection URL with Basic Authentication credentials"
            )
            self.__database_url = database_url_basic_auth

            return OpenSearch(
                hosts=[self.__database_url],
                use_ssl=True,
                verify_cert=True,
                ca_certs=ca_cert,
            )

    def __create_elasticsearch_client(self, database_url):
        """
        Instantiates a Elasticsearch client
        For this client, we do not require any type of authentication

        Args:
            database_url: Connection URL to the search engine
        """
        return Elasticsearch(hosts=[database_url])

    def __create_engine_client(self) -> OpenSearch | Elasticsearch:
        """
        Instantiates the requested search client engine
        """
        # Instantiate a OpenSearch client
        if self.engine_instance_of(engine_name=SearchEngine.OPENSEARCH):
            ca_cert: str = self.__get_ca_cert_path()
            kerberos_auth: bool = self.__require_kerberos_authentication()

            return self.__create_opensearch_client(
                database_url=self.__database_url,
                ca_cert=ca_cert,
                kerberos_auth=kerberos_auth,
            )
        # Instantiate a Elasticsearch client
        elif self.engine_instance_of(engine_name=SearchEngine.ELASTICSEARCH):
            return self.__create_elasticsearch_client(database_url=self.__database_url)

        # Not available engine
        raise NotImplementedError("Search Engine client not available")


# Instantiate the search engine client
search_engine = SearchEngine()
