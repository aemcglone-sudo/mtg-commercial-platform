#!/bin/sh
set -e

echo "Initializing database with Prisma migrations..."

# Install Prisma CLI globally or use npx
npx prisma migrate deploy --skip-generate

echo "Database initialized successfully"
