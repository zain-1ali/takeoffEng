import { api, apiBlob } from "./api.js";

export interface ExportJob {
  id: string;
  projectId: string;
  kind: string;
  status: string;
  progress: number;
  fileName: string | null;
  error: string | null;
  watermark: boolean;
}

export async function downloadProjectExcel(options: {
  projectId: string;
  token: string;
  orgId: string | null;
}): Promise<void> {
  const started = await api<ExportJob>(`/v1/projects/${options.projectId}/exports`, {
    token: options.token,
    orgId: options.orgId,
    body: { kind: "FULL_XLSX" },
  });
  const job = await waitForJob(started.id, options);
  if (job.status !== "DONE") {
    throw new Error(job.error || "Excel export failed.");
  }
  const blob = await apiBlob(`/v1/exports/${job.id}/file`, {
    token: options.token,
    orgId: options.orgId,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = job.fileName || "takeoff.xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function waitForJob(
  jobId: string,
  options: { token: string; orgId: string | null },
  timeoutMs = 60_000,
): Promise<ExportJob> {
  const started = Date.now();
  let delay = 250;
  while (Date.now() - started < timeoutMs) {
    const job = await api<ExportJob>(`/v1/exports/${jobId}`, {
      token: options.token,
      orgId: options.orgId,
    });
    if (job.status === "DONE" || job.status === "FAILED") return job;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(1500, delay + 150);
  }
  throw new Error("Excel export timed out.");
}
