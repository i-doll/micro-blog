-- Initialize per-service databases for the blog platform
-- Run against the default postgres database as superuser

CREATE DATABASE blog_users;
CREATE DATABASE blog_posts;
CREATE DATABASE blog_comments;
CREATE DATABASE blog_notifications;
CREATE DATABASE blog_media;

-- Create service-specific users (all use same password in dev)
CREATE USER user_service WITH PASSWORD 'password';
CREATE USER post_service WITH PASSWORD 'password';
CREATE USER comment_service WITH PASSWORD 'password';
CREATE USER notification_service WITH PASSWORD 'password';
CREATE USER media_service WITH PASSWORD 'password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE blog_users TO user_service;
GRANT ALL PRIVILEGES ON DATABASE blog_posts TO post_service;
GRANT ALL PRIVILEGES ON DATABASE blog_comments TO comment_service;
GRANT ALL PRIVILEGES ON DATABASE blog_notifications TO notification_service;
GRANT ALL PRIVILEGES ON DATABASE blog_media TO media_service;

-- Connect to each database and grant schema privileges
\c blog_users
GRANT ALL ON SCHEMA public TO user_service;

\c blog_posts
GRANT ALL ON SCHEMA public TO post_service;

\c blog_comments
GRANT ALL ON SCHEMA public TO comment_service;

\c blog_notifications
GRANT ALL ON SCHEMA public TO notification_service;

\c blog_media
GRANT ALL ON SCHEMA public TO media_service;
