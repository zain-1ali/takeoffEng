import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ProblemError } from "../common/problem.js";
import { env } from "../config/env.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ProblemError) {
    res.status(err.status).type("application/problem+json").json({
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.message,
      ...err.extras,
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).type("application/problem+json").json({
      type: "validation_error",
      title: "Validation error",
      status: 400,
      detail: "Request body is invalid.",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;
  const detail =
    env().NODE_ENV === "production"
      ? "An unexpected error occurred."
      : err instanceof Error
        ? err.message
        : "Unknown error";
  res.status(status).type("application/problem+json").json({
    type: "internal_error",
    title: "Internal server error",
    status,
    detail,
  });
}
