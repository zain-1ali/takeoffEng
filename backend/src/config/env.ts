import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  WEB_URL: z.string().default("http://localhost:5173"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/takeoff_studio"),
  JWT_ACCESS_SECRET: z.string().min(8).default("change-me-access"),
  JWT_REFRESH_SECRET: z.string().min(8).default("change-me-refresh"),
  ACCESS_TTL_SECONDS: z.coerce.number().default(15 * 60),
  REFRESH_TTL_SECONDS: z.coerce.number().default(30 * 24 * 60 * 60),
  MAGIC_LINK_TTL_SECONDS: z.coerce.number().default(15 * 60),
  INVITE_TTL_SECONDS: z.coerce.number().default(7 * 24 * 60 * 60),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("TakeOff Studio <noreply@takeoff.local>"),
  RESEND_API_KEY: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

export function resetEnv(): void {
  cached = undefined;
}
