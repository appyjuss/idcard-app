// src/pages/HomePage.tsx
import { JobCreator } from "@/features/jobs/components/JobCreator";

export function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Home</h1>
        <p className="text-muted-foreground mt-1">
          Create a new batch of ID cards by uploading your files below.
        </p>
      </header>
      
      <JobCreator />
    </div>
  );
}