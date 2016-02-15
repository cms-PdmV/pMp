"""finished_update.py Run after an update to update the last_successful_update time"""
import simplejson as json
import logging
import datetime
import utils
import pyelasticsearch as pyes

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    utl = utils.Utils()
    es = pyes.ElasticSearch('http://localhost:9200/')

    # Ensure the document exists
    try:
        es.get('meta', 'meta', 'last_completed_update')
    except pyes.exceptions.ElasticHttpNotFoundError:
        # the index exists but for some reason there is not last_completed_update document
        # a new one will simply be created
        logging.warning(utl.get_time() + ' meta/last_completed_update document not found.')
        pass
    except pyes.exceptions.ElasticHttpError as ex:
        # could be that there's no index
        try:
            logging.warning(utl.get_time() + ' Meta index may not exist. Creating.')
            mapping = {
                "properties": {
                    "datetime": "date"
                }
            }

            es.create_index('meta')

            logging.info(utl.get_time() + ' Pushing mapping to for meta/meta doc type')
            es.put_mapping('meta', 'meta', mapping)
        except pyes.exceptions.IndexAlreadyExistsError:
            # It wasn't that. Throw the original exception
            logging.error(utl.get_time() + ' Index already existed. Throwing original exception.')
            raise ex

    logging.info(utl.get_time() + ' Updating meta/last_completed_update...')
    document = { 'datetime': int(datetime.datetime.now().strftime('%s')) * 1000 }
    es.index('meta', 'meta', document, id='last_completed_update', overwrite_existing=True)

