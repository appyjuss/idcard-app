// src/features/jobs/components/JobCreator.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { Loader2, UploadCloud, File as FileIcon, X } from "lucide-react";
import { useJobStore } from "@/stores/jobStore";
import { useNavigate } from "react-router-dom";

type ApiErrorResponse = {
    response?: { data?: { message?: string; }; };
    message: string;
};

// A small, reusable component for each file input row
function FileInputRow({
    title,
    description,
    file,
    onFileChange,
    accept
}: {
    title: string,
    description: string,
    file: File | null,
    onFileChange: (file: File | null) => void,
    accept: string
}) {
    const inputId = `file-input-${title.replace(/\s+/g, '-')}`;

    if (file) {
        return (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{file.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onFileChange(null)}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    return (
        <label htmlFor={inputId} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
            <div className="text-center">
                <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="mt-2 text-lg font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
                <Button size="sm" variant="outline" className="mt-4">Upload</Button>
            </div>
            <input id={inputId} type="file" className="sr-only" accept={accept} onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
        </label>
    );
}

export function JobCreator() {
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [templateFile, setTemplateFile] = useState<File | null>(null);
    const [photosZip, setPhotosZip] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const { addJobOptimistically } = useJobStore();
    const navigate = useNavigate();

    const canSubmit = csvFile && templateFile && photosZip;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        setIsLoading(true);

        const formData = new FormData();
        formData.append('csvFile', csvFile);
        formData.append('templateFile', templateFile);
        formData.append('photosZip', photosZip);

        toast.loading("Creating job...");
        try {
            const response = await apiClient.post('/jobs', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

            toast.dismiss();
            toast.success(`Job #${response.data.jobId} created!`);
            
            // Add to our global store
            addJobOptimistically({
                id: response.data.jobId,
                status: response.data.jobStatus,
                total_cards: response.data.totalCards,
                processed_cards: 0,
                created_at: new Date().toISOString(),
                original_csv_filename: csvFile.name,
            });
            
            // Navigate to the new job's detail page
            navigate(`/jobs/${response.data.jobId}`);

        } catch (err) {
            setIsLoading(false);
            toast.dismiss();
            const error = err as ApiErrorResponse;
            toast.error("Job Creation Failed", { description: error.response?.data?.message || "An unknown error occurred." });
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6">
                <FileInputRow 
                    title="SVG Template" 
                    description="Drag and drop or upload your SVG template file."
                    file={templateFile}
                    onFileChange={setTemplateFile}
                    accept=".svg, image/svg+xml"
                />
                <FileInputRow 
                    title="CSV Data" 
                    description="Drag and drop or upload your CSV data file."
                    file={csvFile}
                    onFileChange={setCsvFile}
                    accept=".csv"
                />
                <FileInputRow 
                    title="Photo ZIP File" 
                    description="Drag and drop or upload your ZIP file containing photos."
                    file={photosZip}
                    onFileChange={setPhotosZip}
                    accept=".zip, application/zip"
                />
                
                <div className="flex justify-end pt-4">
                    <Button size="lg" type="submit" disabled={!canSubmit || isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Job
                    </Button>
                </div>
            </div>
        </form>
    );
}