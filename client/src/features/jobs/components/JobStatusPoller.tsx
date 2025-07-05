// src/features/jobs/components/JobStatusPoller.tsx
import { useEffect } from 'react';
import { useJobStore } from '@/stores/jobStore';
import { apiClient } from '@/lib/api-client';

interface PollStatus {
    jobId: number;
    jobStatus: string;
    successfullyProcessedCards: number;
}

export function JobStatusPoller() {
    const jobs = useJobStore((state) => state.jobs);
    const updateJob = useJobStore((state) => state.updateJob);

    useEffect(() => {
        const processingJobs = jobs.filter(j => ['queued', 'processing'].includes(j.status));
        if (processingJobs.length === 0) return;

        const intervalId = setInterval(() => {
            processingJobs.forEach(async (job) => {
                try {
                    const response = await apiClient.get<PollStatus>(`/jobs/${job.id}/status`);
                    const { jobStatus, successfullyProcessedCards } = response.data;
                    updateJob({
                        id: job.id,
                        status: jobStatus,
                        processed_cards: successfullyProcessedCards,
                    });
                } catch (error) {
                    console.error(`Failed to poll job ${job.id}`, error);
                }
            });
        }, 3000);

        return () => clearInterval(intervalId);
    }, [jobs, updateJob]);

    return null;
}