// src/pages/JobsListPage.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobStore } from '@/stores/jobStore';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, PlusCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

// Helper function to determine the color of the status badge
const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        case 'completed':
            return 'default'; // This is green in the default theme
        case 'completed_with_errors':
            return 'default';
        case 'failed':
            return 'destructive';
        case 'processing':
            return 'secondary';
        case 'queued':
            return 'outline';
        default:
            return 'secondary';
    }
};

export function JobsListPage() {
  // Get all the necessary state and actions from our Zustand store
  const { jobs, isLoading, error, fetchJobs } = useJobStore();
  const navigate = useNavigate();

  // Fetch the list of jobs when the component first mounts.
  // The dependency array ensures this only runs once per mount.
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const renderTableBody = () => {
    if (isLoading && jobs.length === 0) {
        return (
            <TableRow>
                <TableCell colSpan={3} className="h-48 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                </TableCell>
            </TableRow>
        );
    }

    if (error) {
        return (
             <TableRow>
                <TableCell colSpan={3}>
                    <Alert variant="destructive" className="my-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error Loading Jobs</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </TableCell>
            </TableRow>
        );
    }

    if (jobs.length === 0) {
        return (
             <TableRow>
                <TableCell colSpan={3} className="h-48 text-center text-muted-foreground">
                    No jobs found. Click "New Job" to get started.
                </TableCell>
            </TableRow>
        );
    }

    return jobs.map((job) => (
        // Make the entire row clickable, navigating to the detail page
        <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/jobs/${job.id}`)}>
            <TableCell className="font-medium">
                {/* Use a div to prevent text from wrapping awkwardly */}
                <div className="font-semibold">{job.original_csv_filename}</div>
                <div className="text-xs text-muted-foreground">Job #{job.id}</div>
            </TableCell>
            <TableCell>
                {format(new Date(job.created_at), 'MMM d, yyyy, h:mm a')}
            </TableCell>
            <TableCell>
                <Badge variant={getStatusVariant(job.status)} className="capitalize">
                    {job.status.replace(/_/g, ' ')}
                </Badge>
            </TableCell>
        </TableRow>
    ));
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Jobs</h1>
                <p className="text-muted-foreground mt-1">
                    View the history and status of all your ID card generation jobs.
                </p>
            </div>
            {/* The "New Job" button navigates the user to the home page for creation */}
            <Button onClick={() => navigate('/')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Job
            </Button>
        </div>

        <Card>
            <CardHeader>
                {/* You could add search or filter components here in the future */}
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Job Name</TableHead>
                                <TableHead>Date Created</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {renderTableBody()}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}