const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const p = new PrismaClient();

async function testLogin() {
  try {
    const employee = await p.employee.findUnique({where:{email:'admin@zkt.com'}});
    console.log('Employee found:', employee ? 'yes' : 'no');
    if (employee) {
      console.log('Has password:', !!employee.password);
      const isValid = await bcrypt.compare('admin123', employee.password);
      console.log('Password valid:', isValid);
      
      const accessToken = jwt.sign({ id: employee.id, email: employee.email }, 'test-secret', { expiresIn: '7d' });
      console.log('Token generated:', accessToken.substring(0, 20) + '...');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await p.$disconnect();
  }
}
testLogin();