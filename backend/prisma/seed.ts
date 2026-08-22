import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create sample departments
  await prisma.department.createMany({
    data: [
      { name: 'Human Resources', code: 'HR', description: 'Human Resources Department' },
      { name: 'Information Technology', code: 'IT', description: 'Information Technology Department' },
      { name: 'Finance', code: 'FIN', description: 'Finance and Accounting Department' },
      { name: 'Marketing', code: 'MKT', description: 'Marketing and Sales Department' },
      { name: 'Operations', code: 'OPS', description: 'Operations Department' }
    ],
    skipDuplicates: true
  });

  const departments = await prisma.department.findMany({
    where: { code: { in: ['HR', 'IT', 'FIN', 'MKT', 'OPS'] } },
    orderBy: { code: 'asc' }
  });

  const deptByCode: Record<string, string> = {};
  departments.forEach((d: { code: string; id: string }) => { deptByCode[d.code] = d.id; });

  console.log(`✅ Created ${departments.length} departments`);

  // Create sample positions
  await prisma.position.createMany({
    data: [
      { title: 'HR Manager', departmentId: deptByCode['HR'], level: 'MANAGER', minSalary: 60000, maxSalary: 90000 },
      { title: 'HR Specialist', departmentId: deptByCode['HR'], level: 'ASSOCIATE', minSalary: 40000, maxSalary: 60000 },
      { title: 'IT Director', departmentId: deptByCode['IT'], level: 'DIRECTOR', minSalary: 90000, maxSalary: 130000 },
      { title: 'Senior Developer', departmentId: deptByCode['IT'], level: 'SENIOR', minSalary: 70000, maxSalary: 100000 },
      { title: 'Junior Developer', departmentId: deptByCode['IT'], level: 'ASSOCIATE', minSalary: 50000, maxSalary: 70000 },
      { title: 'Finance Manager', departmentId: deptByCode['FIN'], level: 'MANAGER', minSalary: 70000, maxSalary: 100000 },
      { title: 'Accountant', departmentId: deptByCode['FIN'], level: 'ASSOCIATE', minSalary: 45000, maxSalary: 65000 },
      { title: 'Marketing Manager', departmentId: deptByCode['MKT'], level: 'MANAGER', minSalary: 60000, maxSalary: 90000 },
      { title: 'Operations Manager', departmentId: deptByCode['OPS'], level: 'MANAGER', minSalary: 65000, maxSalary: 95000 }
    ],
    skipDuplicates: true
  });

  const positions = await prisma.position.findMany({ orderBy: { title: 'asc' } });

  console.log(`✅ Created ${positions.length} positions`);

  // Create sample employees
  const hashedPassword = await hash('password123', 12);
  const employeeData = [
    { firstName: 'John', lastName: 'Doe', employeeId: 'EMP001', email: 'john.doe@company.com', phone: '555-0101', hireDate: new Date('2022-01-15'), dept: 'HR', pos: 'HR Manager' },
    { firstName: 'Jane', lastName: 'Smith', employeeId: 'EMP002', email: 'jane.smith@company.com', phone: '555-0102', hireDate: new Date('2022-03-22'), dept: 'IT', pos: 'IT Director' },
    { firstName: 'Robert', lastName: 'Johnson', employeeId: 'EMP003', email: 'robert.johnson@company.com', phone: '555-0103', hireDate: new Date('2022-06-10'), dept: 'IT', pos: 'Senior Developer' },
    { firstName: 'Maria', lastName: 'Garcia', employeeId: 'EMP004', email: 'maria.garcia@company.com', phone: '555-0104', hireDate: new Date('2022-08-05'), dept: 'FIN', pos: 'Finance Manager' }
  ];

  for (const e of employeeData) {
    await prisma.employee.create({
      data: {
        firstName: e.firstName,
        lastName: e.lastName,
        employeeId: e.employeeId,
        email: e.email,
        password: hashedPassword,
        phone: e.phone,
        hireDate: e.hireDate,
        departmentId: deptByCode[e.dept],
        positionId: positions.find((p: { title: string }) => p.title === e.pos)?.id ?? positions[0].id,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        salary: 75000
      }
    }).catch(() => null); // Skip if employeeId already exists
  }

  const employees = await prisma.employee.findMany();
  console.log(`✅ Created ${employees.length} employees`);

  // Create sample shifts
  await prisma.shift.createMany({
    data: [
      { name: 'Day Shift', startTime: '08:00', endTime: '17:00', breakTime: 60, description: 'Standard 8-hour day shift' },
      { name: 'Night Shift', startTime: '22:00', endTime: '06:00', breakTime: 60, description: 'Overnight shift' },
      { name: 'Flex Shift', startTime: '07:00', endTime: '16:00', breakTime: 60, description: 'Early start flex shift' }
    ],
    skipDuplicates: true
  });

  const shifts = await prisma.shift.findMany();
  console.log(`✅ Created ${shifts.length} shifts`);

  // Create sample device
  const device = await prisma.device.upsert({
    where: { deviceId: 'ZKT_F22_192_168_31_5' },
    update: { isActive: true },
    create: {
      deviceId: 'ZKT_F22_192_168_31_5',
      name: 'Main Entrance ZKT F22',
      ipAddress: '192.168.31.5',
      port: 4370,
      location: 'Main Office Entrance',
      description: 'ZKT F22 Fingerprint Terminal at main entrance',
      isActive: true
    }
  });

  console.log(`✅ Created device: ${device.name}`);

  console.log('🎉 Database seeding completed successfully!');
  console.log('   Demo login: john.doe@company.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });