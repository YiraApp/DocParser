import bcrypt from 'bcryptjs';
import { getDb } from '../lib/mongodb';

async function seedDatabase() {
  const db = await getDb();
  
  // Hash passwords
  const userHashedPassword = bcrypt.hashSync('User.123', 10);
  const adminHashedPassword = bcrypt.hashSync('Admin.123', 10);
  
  // Update users collection
  await db.collection('users').updateOne(
    { email: "yirause@yira.ai" },
    { $set: { password: userHashedPassword } },
    { upsert: true }
  );

  // Update admin collection - first admin
  await db.collection('admin').updateOne(
    { email: "admins@yira.ai" },
    { $set: { password: adminHashedPassword } },
    { upsert: true }
  );

  // Update admin collection - second admin
  await db.collection('admin').updateOne(
    { email: "admin2@yira.ai" },
    { $set: { password: adminHashedPassword } },
    { upsert: true }
  );
  
  console.log('Database seeded successfully!');
}

seedDatabase().catch(console.error);