-- HR / Payroll master data enhancement

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "location" TEXT;
ALTER TABLE "Employee" ADD COLUMN "nextOfKinName" TEXT;
ALTER TABLE "Employee" ADD COLUMN "nextOfKinPhone" TEXT;
ALTER TABLE "Employee" ADD COLUMN "nextOfKinRelation" TEXT;
ALTER TABLE "Employee" ADD COLUMN "isConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "salaryGradeId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "taxOffice" TEXT;
ALTER TABLE "Employee" ADD COLUMN "pfaName" TEXT;
ALTER TABLE "Employee" ADD COLUMN "rsaPin" TEXT;
ALTER TABLE "Employee" ADD COLUMN "pensionPct" DECIMAL(5,2);
ALTER TABLE "Employee" ADD COLUMN "hmoPlan" TEXT;
ALTER TABLE "Employee" ADD COLUMN "nhiaPct" DECIMAL(5,2);
ALTER TABLE "Employee" ADD COLUMN "payFrequency" TEXT NOT NULL DEFAULT 'monthly';

-- CreateTable
CREATE TABLE "SalaryGrade" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minAmount" DECIMAL(18,2) NOT NULL,
    "maxAmount" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryGrade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalaryChange" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousBasic" DECIMAL(18,4),
    "newBasic" DECIMAL(18,4),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BenefitPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'hmo',
    "description" TEXT,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "employerSharePct" DECIMAL(5,2),
    "employeeSharePct" DECIMAL(5,2),
    "premium" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeBenefit" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "coverageTier" TEXT,
    "employeeContribution" DECIMAL(18,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeBenefit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinaryRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplinaryRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyAcknowledgement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "documentId" TEXT,
    "notes" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankDetailRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedById" TEXT,
    "bankName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "bankAccountName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,

    CONSTRAINT "BankDetailRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN "category" TEXT;
ALTER TABLE "EmployeeDocument" ADD COLUMN "acknowledgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN "accrualPerMonth" DECIMAL(6,2);
ALTER TABLE "LeaveType" ADD COLUMN "carryoverMax" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "overtimeHours" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayrollConfiguration" ADD COLUMN "overtimeFactor" DECIMAL(8,4) NOT NULL DEFAULT 1;
ALTER TABLE "PayrollConfiguration" ADD COLUMN "workingDaysPerMonth" DECIMAL(5,2) NOT NULL DEFAULT 22;

-- AlterTable
ALTER TABLE "PayrollRunLine" ADD COLUMN "overtimePay" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollRunLine" ADD COLUMN "unpaidDeduction" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "SalaryGrade_organizationId_name_key" ON "SalaryGrade"("organizationId", "name");
CREATE INDEX "SalaryGrade_organizationId_idx" ON "SalaryGrade"("organizationId");
CREATE INDEX "SalaryChange_employeeId_idx" ON "SalaryChange"("employeeId");
CREATE UNIQUE INDEX "BenefitPlan_organizationId_name_key" ON "BenefitPlan"("organizationId", "name");
CREATE INDEX "BenefitPlan_organizationId_idx" ON "BenefitPlan"("organizationId");
CREATE UNIQUE INDEX "EmployeeBenefit_employeeId_planId_key" ON "EmployeeBenefit"("employeeId", "planId");
CREATE INDEX "EmployeeBenefit_employeeId_idx" ON "EmployeeBenefit"("employeeId");
CREATE INDEX "DisciplinaryRecord_employeeId_idx" ON "DisciplinaryRecord"("employeeId");
CREATE INDEX "PolicyAcknowledgement_employeeId_idx" ON "PolicyAcknowledgement"("employeeId");
CREATE INDEX "BankDetailRequest_employeeId_idx" ON "BankDetailRequest"("employeeId");
CREATE INDEX "BankDetailRequest_organizationId_status_idx" ON "BankDetailRequest"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_salaryGradeId_fkey" FOREIGN KEY ("salaryGradeId") REFERENCES "SalaryGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalaryChange" ADD CONSTRAINT "SalaryChange_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeBenefit" ADD CONSTRAINT "EmployeeBenefit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeBenefit" ADD CONSTRAINT "EmployeeBenefit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BenefitPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryRecord" ADD CONSTRAINT "DisciplinaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankDetailRequest" ADD CONSTRAINT "BankDetailRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankDetailRequest" ADD CONSTRAINT "BankDetailRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankDetailRequest" ADD CONSTRAINT "BankDetailRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankDetailRequest" ADD CONSTRAINT "BankDetailRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;