SELECT 'CREATE DATABASE "lks_database"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lks_database');
\gexec

SELECT 'CREATE DATABASE "keycloak_db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak_db');
\gexec

SELECT 'CREATE DATABASE "sonarqube"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sonarqube');
\gexec
