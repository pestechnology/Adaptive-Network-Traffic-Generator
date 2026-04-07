import { useState, useEffect } from "react";
import {
    Calendar, Clock, Server,
    ChevronDown, Loader2, AlertCircle,
    RefreshCw, Trash2, ExternalLink
} from "lucide-react";
import {
    getScheduledJobs,
    scheduleOnce,
    scheduleInterval,
    getProfiles,
    deleteScheduledJob
} from "@/lib/api";
import { ScheduledJob, TriggerType } from "@/types/traffic";
import { useToast } from "@/hooks/use-toast";

export function Scheduler() {
    const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
    const [profiles, setProfiles] = useState<string[]>([]);
    const [scheduleMode, setScheduleMode] = useState<TriggerType>("once");
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        profile_name: "",
        destination: "",
        run_time: "",
        interval_seconds: 10
    });
    const [showHistory, setShowHistory] = useState(false);

    const { toast } = useToast();

    const fetchScheduledJobs = async () => {
        try {
            setIsFetching(true);
            const data = await getScheduledJobs();
            console.log("Fetched Scheduled Jobs API Response:", data);

            let normalizedArr: ScheduledJob[] = [];

            if (Array.isArray(data)) {
                normalizedArr = data;
            } else if (data && typeof data === 'object') {
                // Check if it's a wrapped object like { jobs: [...] } or { scheduled_jobs: [...] }
                const wrappedData = data.jobs || data.scheduled_jobs || data.data || data.active || data.history;
                if (Array.isArray(wrappedData)) {
                    normalizedArr = wrappedData;
                } else {
                    // It's a dictionary of jobs
                    normalizedArr = Object.entries(data).map(([key, value]: [string, any]) => {
                        // Ensure value is an object before spreading
                        const jobData = (value && typeof value === 'object') ? value : {};
                        return {
                            ...jobData,
                            scheduled_id: jobData.scheduled_id || key,
                            // Ensure we have some profile name even if missing
                            profile_name: jobData.profile_name || jobData.profile || "Unknown",
                            type: jobData.type || jobData.trigger_type || "once",
                            status: jobData.status || "scheduled"
                        };
                    });
                }
            }

            console.log("Normalized Scheduled Jobs:", normalizedArr);
            setScheduledJobs(normalizedArr);
        } catch (err) {
            console.error("Failed to fetch scheduled jobs:", err);
        } finally {
            setIsFetching(false);
        }
    };

    const handleCancelSchedule = async (id: string) => {
        try {
            await deleteScheduledJob(id);
            toast({ title: "Schedule Cancelled", description: "Successfully removed scheduled job." });
            fetchScheduledJobs();
        } catch (err) {
            toast({ title: "Cancel Failed", description: "Could not remove scheduled job.", variant: "destructive" });
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "N/A";

        return date.toLocaleString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: Record<string, string> = {
            scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
            running: "bg-green-500/10 text-green-500 border-green-500/20",
            completed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
            failed: "bg-red-500/10 text-red-500 border-red-500/20",
            cancelled: "bg-orange-500/10 text-orange-500 border-orange-500/20"
        };
        const style = styles[status.toLowerCase()] || "bg-surface border-border text-text-secondary";
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
                {status.toUpperCase()}
            </span>
        );
    };

    useEffect(() => {
        const loadProfiles = async () => {
            try {
                const data = await getProfiles();
                setProfiles(data);
            } catch {
                toast({ title: "Failed to load profiles", variant: "destructive" });
            }
        };
        loadProfiles();
        fetchScheduledJobs();

        // Poll every 5 seconds
        const interval = setInterval(fetchScheduledJobs, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setScheduleForm(prev => ({
            ...prev,
            [name]: name === "interval_seconds" ? parseInt(value) || 0 : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scheduleForm.profile_name) {
            toast({ title: "Select Profile", description: "Please select a traffic profile", variant: "destructive" });
            return;
        }
        if (!scheduleForm.destination) {
            toast({ title: "No Destination", description: "Target destination is required", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            if (scheduleMode === "once") {
                if (!scheduleForm.run_time) {
                    toast({ title: "Select Time", description: "Please select a run time", variant: "destructive" });
                    setIsLoading(false);
                    return;
                }
                // Convert local datetime to ISO
                let isoTime: string;
                try {
                    isoTime = new Date(scheduleForm.run_time).toISOString();
                } catch (dateErr) {
                    console.error("Invalid date selected:", scheduleForm.run_time, dateErr);
                    toast({
                        title: "Invalid Date",
                        description: "The selected date/time is invalid.",
                        variant: "destructive"
                    });
                    setIsLoading(false);
                    return;
                }

                console.log("Scheduling ONCE job:", {
                    profile: scheduleForm.profile_name,
                    destination: scheduleForm.destination,
                    time: isoTime
                });

                await scheduleOnce(scheduleForm.profile_name, scheduleForm.destination, isoTime);
            } else {
                if (scheduleForm.interval_seconds <= 0) {
                    toast({
                        title: "Invalid Interval",
                        description: "Interval must be a positive number of seconds.",
                        variant: "destructive"
                    });
                    setIsLoading(false);
                    return;
                }

                console.log("Scheduling INTERVAL job:", {
                    profile: scheduleForm.profile_name,
                    destination: scheduleForm.destination,
                    interval: scheduleForm.interval_seconds
                });

                await scheduleInterval(scheduleForm.profile_name, scheduleForm.destination, scheduleForm.interval_seconds);
            }

            toast({
                title: "Job Scheduled",
                description: `Successfully scheduled ${scheduleMode} job for ${scheduleForm.profile_name}`
            });

            // Reset form
            setScheduleForm({
                profile_name: "",
                destination: "",
                run_time: "",
                interval_seconds: 10
            });

            fetchScheduledJobs();
        } catch (err: any) {
            console.error("Scheduling Failed Details:", {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status
            });

            const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.message;

            toast({
                title: "Scheduling Failed",
                description: `Failed: ${errorMsg}. Check console for details.`,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Derived state for consistent filtering
    const activeJobs = scheduledJobs.filter(j => j.status === "scheduled" || j.status === "running");
    const displayJobs = showHistory ? scheduledJobs : activeJobs;

    return (
        <div className="grid gap-8 lg:grid-cols-[440px_1fr]">
            {/* ── Section 1: Schedule Job Form ── */}
            <div className="panel-card gradient-border p-8">
                <div className="space-y-8">
                    {/* Form Header */}
                    <div className="space-y-3">
                        <div className="section-label">
                            <div className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                                <Calendar className="h-3.5 w-3.5" />
                            </div>
                            Job Scheduler
                        </div>
                        <h3 className="font-display text-2xl font-bold tracking-tight">
                            Schedule Execution
                        </h3>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Define one-time or recurring traffic scenarios to run automatically.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-7">
                        {/* Profile Selector */}
                        <div className="space-y-2.5">
                            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                                Traffic Profile
                            </label>
                            <div className="relative">
                                <select
                                    name="profile_name"
                                    value={scheduleForm.profile_name}
                                    onChange={handleInputChange}
                                    className="premium-input w-full appearance-none pr-10 cursor-pointer"
                                >
                                    <option value="">— Select a profile —</option>
                                    {profiles.map((profile) => (
                                        <option key={profile} value={profile}>{profile}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
                            </div>
                        </div>

                        {/* Destination */}
                        <div className="space-y-2.5">
                            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                                Target Destination
                            </label>
                            <div className="flex items-center gap-2 relative">
                                <Server className="absolute left-3 h-4 w-4 text-text-secondary pointer-events-none" />
                                <input
                                    name="destination"
                                    placeholder="192.168.0.10"
                                    value={scheduleForm.destination}
                                    onChange={handleInputChange}
                                    className="premium-input pl-10 flex-1"
                                />
                            </div>
                        </div>

                        {/* Mode Toggle */}
                        <div className="space-y-2.5">
                            <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                                Schedule Mode
                            </label>
                            <div className="flex glass border border-border/50 rounded-xl p-1 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setScheduleMode("once")}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${scheduleMode === "once"
                                        ? "bg-primary text-primary-foreground shadow-lg"
                                        : "text-text-secondary hover:text-foreground hover:bg-white/5"
                                        }`}
                                >
                                    <Clock className="h-3.5 w-3.5" />
                                    One-time
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScheduleMode("interval")}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${scheduleMode === "interval"
                                        ? "bg-primary text-primary-foreground shadow-lg"
                                        : "text-text-secondary hover:text-foreground hover:bg-white/5"
                                        }`}
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Interval
                                </button>
                            </div>
                        </div>

                        {/* Dynamic Fields based on Mode */}
                        {scheduleMode === "once" ? (
                            <div className="space-y-2.5 animate-fade-in">
                                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                                    Run Time
                                </label>
                                <input
                                    type="datetime-local"
                                    name="run_time"
                                    value={scheduleForm.run_time}
                                    onChange={handleInputChange}
                                    className="premium-input w-full cursor-pointer"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2.5 animate-fade-in">
                                <label className="text-xs uppercase tracking-widest text-text-secondary font-medium">
                                    Interval (seconds)
                                </label>
                                <input
                                    type="number"
                                    name="interval_seconds"
                                    min="1"
                                    value={scheduleForm.interval_seconds}
                                    onChange={handleInputChange}
                                    className="premium-input w-full"
                                />
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="shimmer-btn w-full py-4 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                                background: isLoading
                                    ? "hsl(var(--primary) / 0.6)"
                                    : "linear-gradient(135deg, hsl(258 92% 68%), hsl(258 92% 58%))",
                                color: "hsl(var(--primary-foreground))",
                                boxShadow: isLoading ? "none" : "0 4px 24px hsl(258 92% 68% / 0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
                            }}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Scheduling...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Schedule Job
                                </span>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* ── Section 2: Scheduled Jobs Table ── */}
            <div className="panel-card p-8">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isFetching ? 'bg-primary animate-pulse' : 'bg-success'}`} />
                            <h3 className="font-display text-lg font-semibold text-foreground">
                                Scheduled Jobs
                            </h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowHistory(!showHistory)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${showHistory
                                    ? "bg-primary/20 border-primary/40 text-primary"
                                    : "bg-surface border-border text-text-secondary hover:border-primary/30"
                                    }`}
                            >
                                <RefreshCw className={`h-3 w-3 ${showHistory ? "text-primary" : "text-text-secondary"}`} />
                                {showHistory ? "Active Schedules" : "History"}
                            </button>
                            <button
                                onClick={fetchScheduledJobs}
                                disabled={isFetching}
                                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all group"
                            >
                                <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                <span className="text-xs font-mono font-bold">
                                    {displayJobs.length} {showHistory ? "Total" : "Active"}
                                </span>
                            </button>
                        </div>
                    </div>

                    {scheduledJobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 bg-surface/30 rounded-2xl border border-dashed border-border">
                            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center">
                                <Clock className="h-5 w-5 text-text-secondary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">No scheduled jobs</p>
                                <p className="text-xs text-text-secondary">Define a schedule to see it listed here.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border/50 glass">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-border/50 text-[10px] uppercase tracking-widest text-text-secondary font-bold">
                                        <th className="px-4 py-4">Profile / Destination</th>
                                        <th className="px-4 py-4">Scheduled At</th>
                                        <th className="px-4 py-4">Run Time</th>
                                        <th className="px-4 py-4">Interval</th>
                                        <th className="px-4 py-4">Next Run</th>
                                        <th className="px-4 py-4">Status</th>
                                        <th className="px-4 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {displayJobs.map((job) => (
                                        <tr key={job.scheduled_id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground">{job.profile_name}</span>
                                                    <span className="text-xs text-text-secondary font-mono">{job.destination}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 font-mono text-xs text-foreground/70">
                                                {formatDate(job.created_at)}
                                            </td>
                                            <td className="px-4 py-4 font-mono text-xs text-foreground/70">
                                                {job.type === "once" ? formatDate(job.run_time) : "N/A"}
                                            </td>
                                            <td className="px-4 py-4 font-mono text-xs text-foreground/70">
                                                {job.type === "interval" ? `${job.interval_seconds} sec` : "N/A"}
                                            </td>
                                            <td className="px-4 py-4 font-mono text-xs text-primary font-medium">
                                                {formatDate(job.next_run_time)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <StatusBadge status={job.status} />
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {job.last_execution_job_id && (
                                                        <button
                                                            onClick={() => toast({ title: "View Execution", description: `Navigating to ${job.last_execution_job_id}` })}
                                                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
                                                            title="View Execution"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleCancelSchedule(job.scheduled_id)}
                                                        disabled={job.status === "completed" || job.status === "cancelled"}
                                                        className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all border border-destructive/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Cancel Schedule"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <p className="text-[10px] text-text-secondary italic flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" />
                        Table polls every 5 seconds to provide real-time schedule updates.
                    </p>
                </div>
            </div>
        </div>
    );
}
