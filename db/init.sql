-- AI Mock Interview Agent — Database Initialization
-- This script runs automatically when PostgreSQL container starts for the first time

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- The actual schema is managed by Prisma Migrations.
-- This file exists for any extensions or seed data needed before Prisma runs.

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE interview_db TO interview_user;
