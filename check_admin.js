const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.employee.findMany({select:{id:true, email:true, employeeId:true, status:true}}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>console.error(e)).finally(()=>p.$disconnect())