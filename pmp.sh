#!/usr/bin/env bash

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

if [[ $1 == "start" ]]
then
    echo "Starting pMp..."
    if [[ $2 == "dev" ]]
    then
        cd $DIR && python3 run.py dev
    else
        cd $DIR && python3 run.py
    fi
    echo "Started pMp"
fi

if [[ $1 == "stop" ]]
then
    echo "Stopping pMp..."
    IFS=$'\n'
    echo 'Killing all run.py'
    for x in $(ps -e -f | grep run.py | grep python3 | grep $USER); do
       echo "Will kill $x"
       kill -9 `echo $x | awk {'print $2'}`
    done
    echo 'Killing all grunt'
    for x in $(ps -e -f | grep grunt | grep $USER); do
       echo "Will kill $x"
       kill -9 `echo $x | awk {'print $2'}`
    done
    unset IFS
fi

if [[ $1 == "restart" ]]
then
    echo "Restarting pMp..."
    (cd $DIR && ./pmp.sh stop)
    (cd $DIR && ./pmp.sh start)
fi

if [[ $1 == "update" ]]
then
    echo "Updating pMp..."
    (cd $DIR && ./pmp.sh stop)
    # echo "Pulling updates..."
    # (cd $DIR && git pull)
    echo "Running grunt..."
    (cd $DIR/pmp/ && grunt &)
    echo 'Starting service'
    (cd $DIR && ./pmp.sh start)
fi


