import { useParams, Navigate } from "react-router-dom";
import { CollabProvider } from "../collab/CollabProvider.js";
import { ProjectProvider } from "./ProjectProvider.js";
import { DatabankProvider } from "./pricing/DatabankProvider.js";
import { ProjectShell } from "./ProjectShell.js";

export function ProjectEditorPage() {
  const { id } = useParams();
  if (!id) return <Navigate to="/app" replace />;
  return (
    <ProjectProvider id={id}>
      <DatabankProvider>
        <CollabProvider>
          <ProjectShell />
        </CollabProvider>
      </DatabankProvider>
    </ProjectProvider>
  );
}
