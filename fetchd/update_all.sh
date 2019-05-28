cookie_path='/home/pdmvserv/prod_cookie.txt'

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o $cookie_path --nocertverify
python36 -u fetch.py requests

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o $cookie_path --nocertverify
python36 -u fetch.py workflows

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o $cookie_path --nocertverify
python36 -u fetch.py chained_requests

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o $cookie_path --nocertverify
python36 -u fetch.py campaigns

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o $cookie_path --nocertverify
python36 -u fetch.py chained_campaigns

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o $cookie_path --nocertverify
python36 -u fetch.py flows
