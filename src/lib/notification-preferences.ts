export type NotificationEventDef = {
  key: string;
  label: string;
  description: string;
};

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  { key: "leave", label: "Leave updates", description: "Approvals, rejections and cancellations of your leave requests." },
  { key: "payslip", label: "Payslips", description: "When a new payslip is issued for you." },
  { key: "payroll", label: "Payroll processed", description: "Run published, finalized or paid milestones." },
  { key: "attendance", label: "Attendance flags", description: "Missed check-ins and attendance exceptions." },
  { key: "disciplinary", label: "Disciplinary actions", description: "Records filed against you." },
  { key: "finance", label: "Loans, expenses & reimbursements", description: "Your loan, expense claim or reimbursement status changes." },
  { key: "hr_requests", label: "Bank & tax/pension requests", description: "Outcome of your bank detail or tax/pension change requests." },
  { key: "policies", label: "Policy acknowledgements", description: "New policies requiring your acknowledgement." },
  { key: "system", label: "System announcements", description: "Non-urgent product and account notices." },
];

export const NOTIFICATION_EVENT_KEYS = NOTIFICATION_EVENTS.map((e) => e.key);