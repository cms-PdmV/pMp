cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o /home/jrumsevi/prod_cookie.txt --nocertverify
cern-get-sso-cookie --url https://cms-pdmv-dev.cern.ch/mcm/ -o /home/jrumsevi/dev_cookie.txt --nocertverify
python3 fetch.py requests

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o /home/jrumsevi/prod_cookie.txt --nocertverify
cern-get-sso-cookie --url https://cms-pdmv-dev.cern.ch/mcm/ -o /home/jrumsevi/dev_cookie.txt --nocertverify
python3 fetch.py workflows

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o /home/jrumsevi/prod_cookie.txt --nocertverify
cern-get-sso-cookie --url https://cms-pdmv-dev.cern.ch/mcm/ -o /home/jrumsevi/dev_cookie.txt --nocertverify
python3 fetch.py chained_requests

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o /home/jrumsevi/prod_cookie.txt --nocertverify
cern-get-sso-cookie --url https://cms-pdmv-dev.cern.ch/mcm/ -o /home/jrumsevi/dev_cookie.txt --nocertverify
python3 fetch.py campaigns

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o /home/jrumsevi/prod_cookie.txt --nocertverify
cern-get-sso-cookie --url https://cms-pdmv-dev.cern.ch/mcm/ -o /home/jrumsevi/dev_cookie.txt --nocertverify
python3 fetch.py chained_campaigns

cern-get-sso-cookie --url https://cms-pdmv.cern.ch/mcm/ -o /home/jrumsevi/prod_cookie.txt --nocertverify
cern-get-sso-cookie --url https://cms-pdmv-dev.cern.ch/mcm/ -o /home/jrumsevi/dev_cookie.txt --nocertverify
python3 fetch.py flows
