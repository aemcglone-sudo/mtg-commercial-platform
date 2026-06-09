#!/bin/sh
set -e

echo "Initializing database with Prisma migrations..."

# Run Prisma migrations
npx prisma migrate deploy

echo "Database initialized successfully"
