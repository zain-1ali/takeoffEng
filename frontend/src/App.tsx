import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthProvider.js";
import { RequireAuth } from "./features/auth/RequireAuth.js";
import { LandingPage } from "./features/marketing/LandingPage.js";
import { ProjectEditorPage } from "./features/project/ProjectEditorPage.js";
import { NewProjectWizard } from "./features/workspace/NewProjectWizard.js";
import { WorkspacePage } from "./features/workspace/WorkspacePage.js";
import { InvitePage } from "./pages/InvitePage.js";
import { LoginPage, SignupPage } from "./pages/AuthPages.js";
import { KitPage } from "./pages/KitPage.js";
import { LegalPage } from "./pages/LegalPage.js";
import { PricingPage } from "./pages/PricingPage.js";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<Navigate to="/login" replace />} />
          <Route path="/verify" element={<Navigate to="/login" replace />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/legal/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/legal/terms" element={<LegalPage kind="terms" />} />
          <Route path="/kit" element={<KitPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <WorkspacePage />
              </RequireAuth>
            }
          />
          <Route
            path="/app/new"
            element={
              <RequireAuth>
                <NewProjectWizard />
              </RequireAuth>
            }
          />
          <Route
            path="/app/p/:id/:view?"
            element={
              <RequireAuth>
                <ProjectEditorPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
