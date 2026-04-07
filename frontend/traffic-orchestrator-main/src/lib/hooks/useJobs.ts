import { useQuery } from "@tanstack/react-query";
import { getJobs } from "@/lib/api";
import { Job } from "@/types/traffic";

export function useJobs(refetchInterval = 3000) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs,
    refetchInterval,
  });

  const jobsMap: Record<string, Job> = data ?? {};
  const jobs: Job[] = Object.values(jobsMap);

  const running = jobs.filter((j) => j.state === "RUNNING");
  const completed = jobs.filter((j) => j.state === "COMPLETED");
  const failed = jobs.filter((j) => j.state === "FAILED" || j.state === "STOPPED");
  const paused = jobs.filter((j) => j.state === "PAUSED");

  return {
    jobs,
    jobsMap,
    running,
    completed,
    failed,
    paused,
    isLoading,
    error,
    refetch,
  };
}
