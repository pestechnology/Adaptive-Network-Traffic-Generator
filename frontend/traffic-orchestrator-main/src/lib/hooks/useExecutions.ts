import { useQuery } from "@tanstack/react-query";
import { getExecutions, getExecution } from "@/lib/api";

export function useExecutions(refetchInterval = 10000) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["executions"],
    queryFn: getExecutions,
    refetchInterval,
  });

  return { executions: data, isLoading, error };
}

export function useExecution(jobId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["execution", jobId],
    queryFn: () => getExecution(jobId!),
    enabled: !!jobId,
  });

  return { execution: data, isLoading, error };
}
