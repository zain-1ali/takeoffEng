import type { HydratedDocument } from "mongoose";
import type { MembershipRole } from "../models/enums.js";
import type { ProjectDoc } from "../models/project.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
      orgId?: string;
      membership?: {
        id: string;
        orgId: string;
        userId: string;
        role: MembershipRole;
      };
      project?: HydratedDocument<ProjectDoc>;
    }
  }
}

export {};
