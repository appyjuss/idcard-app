// src/hooks/useJobStatus.ts
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// We need to export this so other components can use it
export interface CardStatus {
    card_id: number;
    card_status: string;
    photo_identifier: string;
    card_error_message?: string;
}

// And this one too
export interface JobStatus {
    jobId: number;
    jobStatus: string;
    totalCards: number;
    successfullyProcessedCards: number;
    failedCardsCount: number;
    createdAt: string;
    completedAt?: string;
    cards: CardStatus[];
}

interface UseJobStatusReturn {
    jobStatus: JobStatus | null;
    isLoading: boolean;
    error: string | null;
}

// This hook fetches the detailed status for ONE job
export function useJobStatus(jobId: string | undefined): UseJobStatusReturn {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
      if (!jobId) {
          setIsLoading(false);
          // Don't set an error, just means no job is selected
          return;
      }

      let isMounted = true; // Prevent state updates if component unmounts

      const fetchStatus = async () => {
          try {
              const response = await apiClient.get<JobStatus>(`/jobs/${jobId}/status`);
              if (isMounted) {
                  setJobStatus(response.data);
                  setIsLoading(false);
                  setError(null);
              }
              const terminalStates = ['completed', 'failed', 'completed_with_errors'];
              return terminalStates.includes(response.data.jobStatus);
          } catch (err) {
              console.error(`Failed to fetch status for job ${jobId}:`, err);
              if (isMounted) {
                  setError("Could not retrieve job status.");
                  setIsLoading(false);
              }
              return true; // Stop polling on error
          }
      };

      // Reset state when jobId changes
      setIsLoading(true);
      setJobStatus(null);
      
      fetchStatus();
      const intervalId = setInterval(async () => {
          const shouldStop = await fetchStatus();
          if (shouldStop) {
              clearInterval(intervalId);
          }
      }, 3000);

      return () => {
          isMounted = false;
          clearInterval(intervalId);
      };
  }, [jobId]);

  return { jobStatus, isLoading, error };
}