import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner'; 

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
    deleteJob: (jobId: number) => Promise<void>;
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

    // Add the action implementation
    deleteJob: async (jobId: number) => {
        // Optimistic UI update: remove the job from the local state immediately.
        set((state) => ({
            jobs: state.jobs.filter((job) => job.id !== jobId),
        }));


        try {
            await apiClient.delete(`/jobs/${jobId}`);
            
        } catch (error) {
            // If the API call fails, we should ideally add the job back to the list
            // and show an error toast. This is advanced "rollback" logic.
            console.error(`Failed to delete job #${jobId} on the server.`, error);
            toast.error("Deletion Failed", { description: `Job #${jobId} could not be deleted from the server.` });
            // To implement rollback, you would call fetchJobs() again here to get the true state.
        }
    },
}));