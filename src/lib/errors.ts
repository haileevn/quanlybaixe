export type AppErrorCode =
  | "PLAN_LIMIT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "CONFLICT";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly extra: Record<string, string | number> | undefined;

  constructor(
    message: string,
    code: AppErrorCode,
    extra?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.extra = extra;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export type ActionOk<T> = { ok: true; data: T };
export type ActionFail = {
  ok: false;
  code: AppErrorCode | "UNKNOWN";
  message: string;
  extra?: Record<string, string | number>;
};
export type ActionResult<T = undefined> = ActionOk<T> | ActionFail;

export function ok(): ActionOk<undefined>;
export function ok<T>(data: T): ActionOk<T>;
export function ok<T>(data?: T) {
  return { ok: true, data } as ActionOk<T>;
}

export function fail(error: unknown): ActionFail {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      extra: error.extra,
    };
  }
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message?: string }[] }).issues;
    const message = issues[0]?.message ?? "Dữ liệu chưa hợp lệ.";
    return { ok: false, code: "VALIDATION", message };
  }
  console.error(error);
  return {
    ok: false,
    code: "UNKNOWN",
    message: "Có lỗi xảy ra. Thử lại giúp mình.",
  };
}
