const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function updateUserEmail() {
  try {
    // Update the user email
    const user = await prisma.user.update({
      where: {
        clerkId: 'user_30jxATDqYuUneSqppGUHNfIo9Qs'
      },
      data: {
        email: 'tasty4459@gmail.com'
      }
    });

    console.log('✅ User email updated successfully!');
    console.log('User ID:', user.id);
    console.log('Clerk ID:', user.clerkId);
    console.log('New Email:', user.email);
    console.log('\nNow you can test Instagram reminders and receive emails at tasty4459@gmail.com');

  } catch (error) {
    console.error('❌ Error updating user email:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserEmail();
