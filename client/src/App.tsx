// src/App.tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";

// Import the pages we will use
import { HomePage } from "@/pages/HomePage"; // The "Create Job" view
import { JobsListPage } from "@/pages/job/JobsListPage"; // The "My Jobs" list view
import { JobDetailPage } from "@/pages/job/JobDetailPage"; // The single job drill-down view
import { NotFoundPage } from "@/pages/NotFoundPage"; // A catch-all for bad URLs

function App() {
    return (
        <ThemeProvider defaultTheme="system" storageKey="cardforge-theme">
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/jobs" element={<JobsListPage />} />
                        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
                        {/* We can add Settings and Help pages later */}
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;