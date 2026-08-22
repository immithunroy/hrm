#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Setting up Prisma...');

try {
  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Run migrations
  console.log('🔄 Running database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  
  // Seed database
  console.log('🌱 Seeding database...');
  execSync('ts-node prisma/seed.ts', { stdio: 'inherit' });
  
  console.log('✅ Prisma setup completed successfully!');
} catch (error) {
  console.error('❌ Error during Prisma setup:', error.message);
  process.exit(1);
}