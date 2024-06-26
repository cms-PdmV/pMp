"""
Builder to instantiate a connector to the Search Engine
This class supports Opensearch connectors
"""

from opensearchpy import OpenSearch
import os
import logging
import re


class SearchEngine:
    """
    This module provides a wrapper for creating a Search Engine client: Opensearch
    as required

    Attributes:
        client (opensearchpy.OpenSearch): Search engine client
    """

    OPENSEARCH = "OPENSEARCH"
    __AVAILABLE_ENGINES = {OPENSEARCH: OpenSearch}

    def __init__(self):
        self.__ca_cert: str = None
        self.__logger = self.__get_logger()
        (
            self.__requested_engine,
            self.__requested_engine_client,
        ) = self.__determine_search_engine()
        self.__database_url = self.__get_search_engine_url()
        self.__engine: OpenSearch = self.__create_engine_client()

    @property
    def client(self):
        return self.__engine

    @property
    def ca_cert(self):
        return self.__ca_cert

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
            "[%(levelname)s][%(name)s][%(asctime)s]: %(message)s"
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

    def __determine_search_engine(self) -> tuple[str, OpenSearch]:
        """
        Determine the client required to be instantiated using
        the configuration provided via the environment variable: SEARCH_ENGINE

        Returns:
           The search engine client identifier and a Opensearch client. A NotImplemented
           error will be raise if the requested search engine is not listed as available.
           A ValueError will be raised if the environment variable is empty.
        """
        # Use Opensearch as default search engine
        # But allow in the future the possibility to switch to Elasticsearch 8.X or higher
        search_engine: str = os.getenv("SEARCH_ENGINE", SearchEngine.OPENSEARCH)
        if not search_engine:
            raise ValueError(
                f"No search engine specified. Please set an available engine via SEARCH_ENGINE environment variable. Available search engines: {SearchEngine.__AVAILABLE_ENGINES}"
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

    def __get_ca_cert_path(self) -> str | None:
        """
        Returns CA certification location required to instantiate the Opensearch client.
        This path must be provided via the environment variable: CA_CERT
        If the environment variable is not provided, the OpenSearch client will
        disable the host certificate verification.

        Returns:
            str | None: CA certificate to validate the connection.
        """
        ca_cert: str = os.getenv("CA_CERT")
        if not ca_cert:
            self.__logger.warning(
                "CERN CA certificate was not provided, disabling host verification"
            )
            return None

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

    def __create_opensearch_client(
        self,
        database_url: str,
        ca_cert: str | None,
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

        if ca_cert:
            return OpenSearch(
                hosts=[self.__database_url],
                use_ssl=True,
                verify_certs=True,
                ca_certs=ca_cert,
            )
        else:
            return OpenSearch(
                hosts=[self.__database_url],
                verify_certs=False,
            )

    def __create_engine_client(self) -> OpenSearch:
        """
        Instantiates the requested search client engine
        """
        # Instantiate a OpenSearch client
        if self.engine_instance_of(engine_name=SearchEngine.OPENSEARCH):
            self.__ca_cert: str | None = self.__get_ca_cert_path()
            return self.__create_opensearch_client(
                database_url=self.__database_url,
                ca_cert=self.__ca_cert,
            )
        # Not available engine
        raise NotImplementedError("Search Engine client not available")


# Instantiate the search engine client
search_engine = SearchEngine()
