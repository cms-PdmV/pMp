from pmp import app

ADMINS = ['cms-pdmv-serv@cern.ch']

if __name__ == '__main__':

    if not app.debug:
        import logging
        from logging import Formatter
        from logging.handlers import SMTPHandler
        mail_handler = SMTPHandler('127.0.0.1',
                                   'vocms089@noreply.com',
                                   ADMINS, 'Production Monitoring Platform: FAILURE')
        mail_handler.setLevel(logging.ERROR)
        mail_handler.setFormatter(Formatter(
                '''
                Message type:       %(levelname)s
                Location:           %(pathname)s:%(lineno)d
                Module:             %(module)s
                Function:           %(funcName)s
                Time:               %(asctime)s
                
                Message:
                    
                %(message)s
                '''
                ))
        app.logger.addHandler(mail_handler)

    app.run(host='0.0.0.0', port=80)
