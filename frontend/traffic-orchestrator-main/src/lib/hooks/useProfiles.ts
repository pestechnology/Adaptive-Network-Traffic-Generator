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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfiles, getProfile, createProfile, updateProfile, deleteProfile } from "@/lib/api";
import { Profile } from "@/types/traffic";

export function useProfiles() {
  const qc = useQueryClient();

  const { data: names = [], isLoading, error } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  const createMut = useMutation({
    mutationFn: (data: Omit<Profile, "id">) => createProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<Profile> }) =>
      updateProfile(name, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteProfile(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });

  return {
    profileNames: names,
    isLoading,
    error,
    getProfile,
    createProfile: createMut.mutateAsync,
    updateProfile: updateMut.mutateAsync,
    deleteProfile: deleteMut.mutateAsync,
    isCreating: createMut.isPending,
    isUpdating: updateMut.isPending,
    isDeleting: deleteMut.isPending,
  };
}
