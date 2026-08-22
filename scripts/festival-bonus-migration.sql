DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Religion') THEN
    CREATE TYPE "Religion" AS ENUM ('ISLAM', 'HINDU', 'BUDDHIST', 'CHRISTIAN', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FestivalBonusType') THEN
    CREATE TYPE "FestivalBonusType" AS ENUM ('EID_UL_FITR', 'EID_UL_ADHA', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BonusCalculationType') THEN
    CREATE TYPE "BonusCalculationType" AS ENUM ('BASIC_SALARY', 'GROSS_SALARY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BonusPaymentMode') THEN
    CREATE TYPE "BonusPaymentMode" AS ENUM ('ONE_TIME', 'TWO_INSTALLMENTS');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BonusInstallmentStatus') THEN
    CREATE TYPE "BonusInstallmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Employee' AND column_name = 'religion') THEN
    ALTER TABLE "Employee" ADD COLUMN "religion" "Religion";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'FestivalBonus') THEN
    CREATE TABLE "FestivalBonus" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "employeeId" TEXT NOT NULL,
      "festivalType" "FestivalBonusType" NOT NULL,
      "customFestivalName" TEXT,
      "year" INTEGER NOT NULL,
      "bonusType" "BonusCalculationType" NOT NULL DEFAULT 'BASIC_SALARY',
      "totalAmount" DECIMAL(65,30) NOT NULL,
      "paymentMode" "BonusPaymentMode" NOT NULL DEFAULT 'ONE_TIME',
      "installment1Amount" DECIMAL(65,30),
      "installment1Date" TIMESTAMP(3),
      "installment1Status" "BonusInstallmentStatus" NOT NULL DEFAULT 'PENDING',
      "installment2Amount" DECIMAL(65,30),
      "installment2Date" TIMESTAMP(3),
      "installment2Status" "BonusInstallmentStatus" NOT NULL DEFAULT 'PENDING',
      "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
      "approvedBy" TEXT,
      "approvedAt" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    );
    CREATE INDEX "FestivalBonus_employeeId_idx" ON "FestivalBonus"("employeeId");
    CREATE INDEX "FestivalBonus_year_idx" ON "FestivalBonus"("year");
    CREATE INDEX "FestivalBonus_festivalType_idx" ON "FestivalBonus"("festivalType");
    CREATE INDEX "FestivalBonus_status_idx" ON "FestivalBonus"("status");
  END IF;
END $$;
