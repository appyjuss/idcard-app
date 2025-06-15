// src/App.tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";

// We will create these pages next
import { HomePage } from "@/pages/HomePage";
import { JobPage } from "@/pages/JobPages";
import { NotFoundPage } from "@/pages/NotFoundPage";


function App() {
    return (
        <ThemeProvider defaultTheme="system" storageKey="id-card-pro-theme">
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/job/:jobId" element={<JobPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App