import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const superAdminEmail = 'admin@beachsocialclub.com';

  // Verifica se o SUPERADMIN já foi criado anteriormente para evitar duplicidade
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (existingSuperAdmin) {
    console.log('⚠️ SUPERADMIN account already exists.');
    return;
  }

  // Gera o hash da senha de forma segura (Salt Rounds = 10)
  const defaultPassword = 'BeachSuperAdmin2026!'; // Troque pela sua senha mestre desejada
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Insere o registro do SUPERADMIN
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Dev Master Admin',
      email: superAdminEmail,
      password: hashedPassword,
      role: Role.SUPERADMIN,
      btRating: 3000.0,
      footvolleyElo: 3000.0,
    },
  });

  console.log('✅ SUPERADMIN created successfully!');
  console.log(`📧 Email: ${superAdmin.email}`);
  console.log(`🔑 Role: ${superAdmin.role}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });