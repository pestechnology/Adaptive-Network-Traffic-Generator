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
