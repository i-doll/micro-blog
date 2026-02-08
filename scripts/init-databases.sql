-- Initialize per-service databases for the blog platform
-- Run against the default postgres database as superuser
--
-- Note: In Kubernetes, Vault creates database users dynamically.
-- This script only creates the databases and grants schema access.
-- For docker-compose dev, users are created with default passwords below.

ALTER USER postgres CREATEROLE;

CREATE DATABASE blog_auth;
CREATE DATABASE blog_users;
CREATE DATABASE blog_posts;
CREATE DATABASE blog_comments;
CREATE DATABASE blog_notifications;
CREATE DATABASE blog_media;

-- Create service-specific users (docker-compose local dev only)
-- In K8s these are created dynamically by Vault's database secrets engine
CREATE USER auth_service WITH PASSWORD 'password';
CREATE USER user_service WITH PASSWORD 'password';
CREATE USER post_service WITH PASSWORD 'password';
CREATE USER comment_service WITH PASSWORD 'password';
CREATE USER notification_service WITH PASSWORD 'password';
CREATE USER media_service WITH PASSWORD 'password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE blog_auth TO auth_service;
GRANT ALL PRIVILEGES ON DATABASE blog_users TO user_service;
GRANT ALL PRIVILEGES ON DATABASE blog_posts TO post_service;
GRANT ALL PRIVILEGES ON DATABASE blog_comments TO comment_service;
GRANT ALL PRIVILEGES ON DATABASE blog_notifications TO notification_service;
GRANT ALL PRIVILEGES ON DATABASE blog_media TO media_service;

-- Connect to each database and grant schema privileges
\c blog_auth
GRANT ALL ON SCHEMA public TO auth_service;
GRANT ALL ON SCHEMA public TO PUBLIC;

\c blog_users
GRANT ALL ON SCHEMA public TO user_service;
GRANT ALL ON SCHEMA public TO PUBLIC;

\c blog_posts
GRANT ALL ON SCHEMA public TO post_service;
GRANT ALL ON SCHEMA public TO PUBLIC;

\c blog_comments
GRANT ALL ON SCHEMA public TO comment_service;
GRANT ALL ON SCHEMA public TO PUBLIC;

\c blog_notifications
GRANT ALL ON SCHEMA public TO notification_service;
GRANT ALL ON SCHEMA public TO PUBLIC;

\c blog_media
GRANT ALL ON SCHEMA public TO media_service;
GRANT ALL ON SCHEMA public TO PUBLIC;
