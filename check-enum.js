const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function checkEnum() {
  try {
    // Check what enum values exist in the database
    const result = await prisma.$queryRaw`
      SELECT e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'GenerationType'
      ORDER BY e.enumsortorder;
    `;
    
    console.log('Current GenerationType enum values in database:');
    console.log(result);
    
    // Try to add the missing enum value
    console.log('\nAttempting to add VIDEO_FPS_BOOST...');
    await prisma.$executeRaw`
      ALTER TYPE "GenerationType" ADD VALUE IF NOT EXISTS 'VIDEO_FPS_BOOST';
    `;
    console.log('✅ Successfully added VIDEO_FPS_BOOST to enum');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnum();
