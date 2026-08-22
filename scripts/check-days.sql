SELECT date, status FROM "Attendance" WHERE "employeeId" = (SELECT id FROM "Employee" WHERE "employeeId" = '101' LIMIT 1) AND date >= '2026-08-01' AND date <= '2026-08-31' ORDER BY date;
