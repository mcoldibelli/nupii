-- The role of Grafana in the database (#303, ADR 0032). It reads only the views
-- of the schema metrics: counts, with no personal data. deploy/publish.sh runs
-- this file after the API applied the migrations, with the variables
-- pw (GRAFANA_DB_PASSWORD of the .env) and db (POSTGRES_DB). It can run again.
SELECT 'CREATE ROLE metrics_reader'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metrics_reader') \gexec

ALTER ROLE metrics_reader LOGIN PASSWORD :'pw' CONNECTION LIMIT 3;
GRANT CONNECT ON DATABASE :"db" TO metrics_reader;
GRANT USAGE ON SCHEMA metrics TO metrics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA metrics TO metrics_reader;
