import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';

export interface JobListJob {
    id: number;
    status: string;
    total_cards: number;
    processed_cards: number;
    created_at: string;
    original_csv_filename: string;
}

interface JobStoreState {
    jobs: JobListJob[];
    activeJobId: number | null;
    isLoading: boolean;
    error: string | null;
    fetchJobs: () => Promise<void>;
    addJobOptimistically: (newJob: JobListJob) => void;
    updateJob: (updatedJob: Partial<JobListJob> & { id: number }) => void;
    setActiveJobId: (jobId: number | null) => void;
}

export const useJobStore = create<JobStoreState>((set) => ({
    jobs: [],
    activeJobId: null, 
    isLoading: false,
    error: null,

    fetchJobs: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await apiClient.get<JobListJob[]>('/jobs');
            set({ jobs: response.data, isLoading: false });
        } catch (err) {
            console.error("Failed to fetch jobs", err);
            set({ error: "Failed to load recent jobs.", isLoading: false });
        }
    },

    addJobOptimistically: (newJob) => {
        set((state) => ({
            jobs: [newJob, ...state.jobs],
        }));
    },

    updateJob: (updatedJob) => {
        set((state) => ({
            jobs: state.jobs.map((job) =>
                job.id === updatedJob.id ? { ...job, ...updatedJob } : job
            ),
        }));
    },
    
    
    setActiveJobId: (jobId) => {
        set({ activeJobId: jobId });
    },
}));