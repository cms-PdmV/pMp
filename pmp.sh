#!/usr/bin/env bash

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

if [[ $1 == "start" ]]
then
    echo "Starting pMp..."

    if [[ $2 == "dev" ]]
    then
        python $DIR/run.py dev&
    else
        python $DIR/run.py &
    fi
fi

if [[ $1 == "stop" ]]
then
    echo "Stopping pMp..."
    kill -9 `ps au | grep 'run_dev.py' | grep python | awk '{print $2}'`
    kill -9 `ps au | grep 'run.py' | grep python | awk '{print $2}'`
    kill -9 `ps au | grep 'grunt' | awk '{print $2}'`
fi

if [[ $1 == "update" ]]
then
    echo "Pulling updates..."
    (cd $DIR && git pull)
    echo "Running grunt..."
    (cd $DIR/pmp/ && grunt &)
    echo "Running bower..."
    (cd $DIR/pmp/static && bower -f install)
    fi
fi