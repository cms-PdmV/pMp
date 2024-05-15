# Build web application bundle
FROM node:16-buster-slim@sha256:1417528032837e47462ea8cfe983108b0152f989e95cba2ddfbe0f0ddc2dcfbd AS frontend

WORKDIR /usr/app

COPY pmp .

# Install grunt-cli
RUN npm install -g grunt-cli

# Install packages
RUN npm install

# Build bundle
RUN grunt concat cssmin htmlmin


# Build dependencies
FROM python:3.11.2-slim-buster@sha256:8f827e9cc31e70c5bdbed516d7d6627b10afad9b837395ac19315685d13b40c2 AS build

WORKDIR /usr/app
RUN python -m venv /usr/app/venv
ENV PATH="/usr/app/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install -r requirements.txt

# Create image for deployment
FROM python:3.11.2-slim-buster@sha256:8f827e9cc31e70c5bdbed516d7d6627b10afad9b837395ac19315685d13b40c2 AS backend

RUN apt update && apt install -y librsvg2-bin

RUN groupadd -g 999 python && useradd -r -u 999 -g python python

RUN mkdir /usr/app && chown python:python /usr/app
WORKDIR /usr/app

COPY --chown=python:python . .
COPY --chown=python:python --from=frontend /usr/app/static/build/ ./pmp/static/build/
COPY --chown=python:python --from=frontend /usr/app/node_modules/ ./pmp/node_modules/
COPY --chown=python:python --from=build /usr/app/venv ./venv

RUN mkdir -p ./pmp/static/tmp/ \
    && chown python:python ./pmp/static/tmp/ \
    && chmod -R 707 ./pmp/static/tmp/

USER 999

ENV PATH="/usr/app/venv/bin:$PATH"
CMD [ "gunicorn", "run:app" ]