const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function updateExistingUsers() {
  try {
    console.log('🔄 Updating existing users with default USER role...');
    
    // Update all users to make sure they have the USER role by default
    const resultAll = await prisma.user.updateMany({
      data: {
        role: 'USER',
      },
    });

    console.log(`✅ Updated ${resultAll.count} users with USER role`);

    // Set your admin user to ADMIN role
    const adminUser = await prisma.user.updateMany({
      where: {
        email: 'rapdeleon0404@gmail.com',
      },
      data: {
        role: 'ADMIN',
      },
    });

    if (adminUser.count > 0) {
      console.log('✅ Set rapdeleon0404@gmail.com as ADMIN');
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Error updating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingUsers();