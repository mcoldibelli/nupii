# Postgres with the two extensions that the system needs: pgvector and PostGIS.
# The pgvector image is the official Postgres image with pgvector. It has the
# PostgreSQL APT repository, which has the PostGIS package.
FROM pgvector/pgvector:0.8.7-pg18-trixie

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-postgis-3 \
 && rm -rf /var/lib/apt/lists/*
