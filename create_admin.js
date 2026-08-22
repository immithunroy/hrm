const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const employee = await p.employee.create({
      data: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@zkt.com',
        password: hashedPassword,
        employeeId: 'ADMIN001',
        hireDate: new Date(),
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        departmentId: (await p.department.findFirst()).id,
        positionId: (await p.position.findFirst()).id,
      }
    });
    console.log('Admin created:', employee);
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
}
createAdmin();