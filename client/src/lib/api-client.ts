import axios from 'axios';

// During development, the proxy will handle forwarding '/api' requests.

const API_BASE_URL = import.meta.env.PROD 
    ? import.meta.env.VITE_API_BASE_URL // In production, use the full URL from .env.production
    : '/api'; // In development, use a relative path that the proxy will catch

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not defined in the production environment. Please check your deployment configuration.");
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export const deleteJob = (jobId: number | string) => {
  return apiClient.delete(`/jobs/${jobId}`);
};