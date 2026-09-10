-- AlterTable: employee expense claims + reimbursement tracking
ALTER TABLE "Expense" ADD COLUMN     "bankRef" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "journalEntryId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "payrollRunId" TEXT,
ADD COLUMN     "reimbursementMethod" TEXT;

-- CreateTable: staff loans & advances
CREATE TABLE "StaffLoan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "monthlyDeduction" DECIMAL(18,4) NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 1,
    "interestRate" DECIMAL(8,4),
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "outstandingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "disbursedById" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: loan repayment schedule
CREATE TABLE "StaffLoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'payroll',
    "amount" DECIMAL(18,4) NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");

-- CreateIndex
CREATE INDEX "StaffLoan_organizationId_idx" ON "StaffLoan"("organizationId");

-- CreateIndex
CREATE INDEX "StaffLoan_employeeId_idx" ON "StaffLoan"("employeeId");

-- CreateIndex
CREATE INDEX "StaffLoan_status_idx" ON "StaffLoan"("status");

-- CreateIndex
CREATE INDEX "StaffLoanRepayment_loanId_idx" ON "StaffLoanRepayment"("loanId");

-- CreateIndex
CREATE INDEX "StaffLoanRepayment_organizationId_idx" ON "StaffLoanRepayment"("organizationId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLoan" ADD CONSTRAINT "StaffLoan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLoan" ADD CONSTRAINT "StaffLoan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLoanRepayment" ADD CONSTRAINT "StaffLoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "StaffLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLoanRepayment" ADD CONSTRAINT "StaffLoanRepayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLoanRepayment" ADD CONSTRAINT "StaffLoanRepayment_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;