/*
 * Authors:
 *   Anikait Nair - anikaitm752@gmail.com
 *   Dr. Swetha P - swethap@pes.edu
 *   Dr. Prasad B Honnavalli - prasadbh@pes.edu
 *
 * Contributors:
 *   ISFCR - office.isfcr@pes.edu
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * SPDX-License-Identifier: Apache-2.0
 */
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
