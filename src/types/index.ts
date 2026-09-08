export type ActionResult<T = undefined> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
};

export const AuditLogAction = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  APPROVE: "approve",
  FINALIZE: "finalize",
  SUBMIT: "submit",
  LOGIN: "login",
  EXPORT: "export",
  RUN_PAYROLL: "run_payroll",
  POST_JOURNAL: "post_journal",
  CLOSE_PERIOD: "close_period",
  ROLE_CHANGE: "role_change",
} as const;

export type AuditLogActionType = (typeof AuditLogAction)[keyof typeof AuditLogAction];
