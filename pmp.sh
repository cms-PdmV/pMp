#!/usr/bin/env bash

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

if [[ $1 == "start" ]]
then
    echo "Starting pMp"

    if [[ $2 == "dev" ]]
    then
        cd $DIR && python3 run.py dev&
    else
        cd $DIR && python3 run.py &
    fi

    echo "Started pMp"
fi

if [[ $1 == "stop" ]]
then
    echo "Stopping pMp"
    NUMBER=`ps aux | grep 'run.py' | grep python | awk '{print $2}'`

    if [[ $NUMBER != "" ]]
    then
	kill -9 $NUMBER
    fi

    NUMBER=`ps aux | grep grunt | awk '{print $2}'`

    if [[ $NUMBER != "" ]]
    then
	kill -9 $NUMBER
    fi
fi

if [[ $1 == "restart" ]]
then
    echo "Restarting pMp"
    (cd $DIR && ./pmp.sh stop)
    (cd $DIR && ./pmp.sh start)
fi

if [[ $1 == "update" ]]
then
    (cd $DIR && ./pmp.sh stop)
    echo "Pulling updates..."
    (cd $DIR && git pull)
    echo "Running bower..."
    (cd $DIR/pmp/static && bower --allow-root -f install)
    echo "Running grunt..."
    (cd $DIR/pmp/ && grunt &)
    (cd $DIR && ./pmp.sh start)
fi
