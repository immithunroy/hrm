import { prisma } from '../config/database';

/**
 * One-time startup migration: add `username` column to Employee, backfill
 * from email prefix, enforce NOT NULL + UNIQUE.
 *
 * Safe to run repeatedly — all operations are idempotent.
 */
export const migrateUsername = async (): Promise<void> => {
  try {
    // 1. Check if the column already exists
    const colCheck = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Employee' AND column_name = 'username'
      ) AS exists
    `);

    if (colCheck[0]?.exists) {
      // Column exists — check if any rows are still NULL
      const nullCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT COUNT(*) AS count FROM "Employee" WHERE "username" IS NULL
      `);
      if (nullCount[0]?.count === 0n) return; // All good
    } else {
      // 2. Add the column (nullable first)
      await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN "username" TEXT`);
      console.log('✅ Added username column to Employee table');
    }

    // 3. Backfill from email prefix
    await prisma.$executeRawUnsafe(`
      UPDATE "Employee" SET "username" = LOWER(SPLIT_PART("email", '@', 1))
      WHERE "username" IS NULL
    `);

    // 4. Handle duplicates by appending numeric suffix
    const dupes = await prisma.$queryRawUnsafe<{ id: string; username: string }[]>(`
      SELECT id, username FROM "Employee"
      WHERE username IN (
        SELECT username FROM "Employee" WHERE username IS NOT NULL
        GROUP BY username HAVING COUNT(*) > 1
      )
      ORDER BY "createdAt"
    `);

    for (const row of dupes) {
      let candidate = row.username;
      let counter = 2;
      while (true) {
        const exists = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
          `SELECT COUNT(*) AS cnt FROM "Employee" WHERE username = $1 AND id != $2`,
          candidate, row.id
        );
        if (exists[0]?.cnt === 0n) break;
        candidate = `${row.username}${counter}`;
        counter++;
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "Employee" SET username = $1 WHERE id = $2`,
        candidate, row.id
      );
    }

    // 5. Set NOT NULL
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Employee" ALTER COLUMN "username" SET NOT NULL`
    );

    // 6. Add unique index (idempotent)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Employee_username_key" ON "Employee"("username")
    `);

    console.log('✅ Username migration complete');
  } catch (error) {
    console.error('⚠️ Username migration failed (non-fatal):', error);
  }
};
