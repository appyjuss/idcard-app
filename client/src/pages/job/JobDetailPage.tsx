// src/pages/JobDetailPage.tsx
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useJobStore } from '@/stores/jobStore';
import { JobDetailView } from '@/features/jobs/components/JobDetailView';
import { ArrowLeft } from 'lucide-react';

export function JobDetailPage() {
    const { jobId } = useParams<{ jobId: string }>();
    const setActiveJobId = useJobStore((state) => state.setActiveJobId);

    // This effect is crucial. It tells our global state which job is currently active,
    // which is important for things like the poller or highlighting.
    // It also syncs the state if the user lands directly on this URL.
    useEffect(() => {
        const numericJobId = jobId ? parseInt(jobId, 10) : null;
        setActiveJobId(numericJobId);
        
        // When the user navigates away from this page, reset the active job.
        return () => {
            setActiveJobId(null);
        }
    }, [jobId, setActiveJobId]);

    return (
        <div className="space-y-6">
            <div>
                <Link to="/jobs" className="flex items-center text-sm text-muted-foreground hover:text-primary mb-4 gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back to My Jobs
                </Link>
                <h1 className="text-3xl font-bold tracking-tight">Job Details</h1>
            </div>
            <JobDetailView />
        </div>
    );
}