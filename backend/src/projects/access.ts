import type { NextFunction, Request, Response } from "express";
import { notFound } from "../common/problem.js";
import { Project } from "../models/project.js";

export function requireProject(req: Request, _res: Response, next: NextFunction): void {
  void loadProject(req).then(next).catch(next);
}

async function loadProject(req: Request): Promise<void> {
  const project = await Project.findOne({
    _id: req.params.id,
    orgId: req.orgId,
  });
  if (!project) throw notFound("Project not found.");
  req.project = project as NonNullable<Request["project"]>;
}
