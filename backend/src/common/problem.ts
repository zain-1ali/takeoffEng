export class ProblemError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly extras: Record<string, unknown>;

  constructor(
    status: number,
    type: string,
    title: string,
    detail: string,
    extras: Record<string, unknown> = {},
  ) {
    super(detail);
    this.name = "ProblemError";
    this.status = status;
    this.type = type;
    this.title = title;
    this.extras = extras;
  }
}

export function problem(
  status: number,
  type: string,
  title: string,
  detail: string,
  extras?: Record<string, unknown>,
): ProblemError {
  return new ProblemError(status, type, title, detail, extras ?? {});
}

export function unauthorized(detail = "Authentication required."): ProblemError {
  return problem(401, "unauthorized", "Unauthorized", detail);
}

export function forbidden(detail = "You do not have permission to do that."): ProblemError {
  return problem(403, "forbidden", "Forbidden", detail);
}

export function notFound(detail = "Not found."): ProblemError {
  return problem(404, "not_found", "Not found", detail);
}

export function conflict(detail: string): ProblemError {
  return problem(409, "conflict", "Conflict", detail);
}

export function upgradeRequired(
  entitlement: string,
  currentPlan: string,
  requiredPlan: string,
): ProblemError {
  return problem(
    402,
    "upgrade_required",
    "Upgrade required",
    `Your ${currentPlan} plan does not include ${entitlement}.`,
    { entitlement, currentPlan, requiredPlan },
  );
}
