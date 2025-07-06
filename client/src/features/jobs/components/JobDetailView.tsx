// src/features/jobs/components/JobDetailView.tsx
import { useJobStatus } from '@/hooks/useJobStatus';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertCircle, PartyPopper, Download, XCircle, CheckCircle2 } from 'lucide-react';
import { useJobStore } from '@/stores/jobStore';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';

export function JobDetailView() {
    const activeJobId = useJobStore((state) => state.activeJobId);
    const deleteJobAction = useJobStore((state) => state.deleteJob);
    const navigate = useNavigate();
    const { jobStatus, isLoading, error } = useJobStatus(activeJobId?.toString());

    if (isLoading && !jobStatus) {
        return <div className="flex justify-center p-16"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>;
    }

    if (error) {
        return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
    }

    if (!jobStatus) {
        return <p className="text-center text-muted-foreground py-16">No job selected or found.</p>;
    }

    const isCompleted = ['completed', 'completed_with_errors'].includes(jobStatus.jobStatus);
    const isProcessing = ['queued', 'processing'].includes(jobStatus.jobStatus);
    const progressValue = jobStatus.totalCards > 0 ? (jobStatus.successfullyProcessedCards / jobStatus.totalCards) * 100 : 0;
    
    // Construct the full download URL for the ZIP file
    const downloadZipUrl = `${apiClient.defaults.baseURL}/jobs/${jobStatus.jobId}/download`;

    const handleDelete = async () => {
    if (!jobStatus) return;

    toast.loading(`Deleting job #${jobStatus.jobId}...`);
    await deleteJobAction(jobStatus.jobId);
    toast.dismiss();
    toast.success(`Job #${jobStatus.jobId} has been deleted.`);
    
    // Navigate the user back to the jobs list after deletion
    navigate('/jobs');
};


    return (
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: Summary and Controls */}
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Job Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Job ID</span>
                            <span className="font-mono">#{jobStatus.jobId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="font-semibold capitalize">{jobStatus.jobStatus.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{format(new Date(jobStatus.createdAt), 'MMM d, yyyy')}</span>
                        </div>

                        {isProcessing && (
                            <div className="pt-2 space-y-2">
                                <Progress value={progressValue} />
                                <p className="text-sm text-center text-muted-foreground">
                                    {jobStatus.successfullyProcessedCards} of {jobStatus.totalCards} cards processed
                                </p>
                            </div>
                        )}

                        {isCompleted && (
                            <Alert className="mt-4 border-green-500 text-green-700 dark:text-green-400">
                                <PartyPopper className="h-4 w-4" />
                                <AlertTitle className="font-bold">Generation Complete!</AlertTitle>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
                
                {isCompleted && (
                    <Card>
                        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                        <CardContent className="grid gap-2">
                            <Button asChild>
                                <a href={downloadZipUrl} download>
                                    <Download className="mr-2 h-4 w-4" /> Download All (ZIP)
                                </a>
                            </Button>
                            {/* <Button variant="outline">Redo Job</Button> */}
                            <ConfirmDialog
                                title="Are you absolutely sure?"
                                description="This action cannot be undone. This will permanently delete the job and all associated generated files."
                                onConfirm={handleDelete}
                                trigger={
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Job
                                    </Button>
                                }
                            />
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Right Column: Individual Card Details */}
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader><CardTitle>Individual Cards ({jobStatus.cards?.length || 0})</CardTitle></CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Card Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Download</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobStatus.cards?.map((card) => (
                                        <TableRow key={card.card_id}>
                                            <TableCell className="font-mono">{card.photo_identifier}</TableCell>
                                            <TableCell>
                                                {card.card_status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                                {card.card_status === 'failed' && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                {/* The icon itself doesn't get any props related to the tooltip */}
                                                                <XCircle className="h-5 w-5 text-red-500" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {/* The error message goes inside the TooltipContent */}
                                                                <p>{card.card_error_message}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}{['queued', 'processing'].includes(card.card_status) && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {card.card_status === 'completed' && (
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <a href={`${apiClient.defaults.baseURL}/jobs/cards/${card.card_id}/download`} download>
                                                            <Download className="h-4 w-4"/>
                                                        </a>
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}