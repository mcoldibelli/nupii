# Postgres with the two extensions that the system needs: pgvector and PostGIS.
# The pgvector image is the official Postgres image with pgvector. It has the
# PostgreSQL APT repository, which has the PostGIS package.
FROM pgvector/pgvector:0.8.7-pg18-trixie

# The version of PostGIS is fixed: a newer package of the APT repository can
# need a newer Postgres than the one of the base image (it happened with
# 3.7.0+dfsg-1.pgdg13+2 and Postgres 18.6). Change both together.
ARG POSTGIS_VERSION=3.7.0+dfsg-1.pgdg13+1
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-18-postgis-3=${POSTGIS_VERSION} postgresql-18-postgis-3-scripts=${POSTGIS_VERSION} \
 && rm -rf /var/lib/apt/lists/*
