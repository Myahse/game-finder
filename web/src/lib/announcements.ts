import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Announcement } from './types'

export const announcementKeys = {
  pending: ['announcements', 'pending'] as const,
  one: (id: string) => ['announcements', id] as const,
  admin: ['admin', 'announcements'] as const,
}

/** The newest announcement this user hasn't seen yet (null when there's none). */
export function usePendingAnnouncement(enabled: boolean) {
  return useQuery({
    queryKey: announcementKeys.pending,
    queryFn: () => api<Announcement | null>('/api/announcements/pending'),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
}

/** One announcement by id (opened from a notification, even if already seen). */
export function useAnnouncement(id: string | null) {
  return useQuery({
    queryKey: announcementKeys.one(id ?? ''),
    queryFn: () => api<Announcement>(`/api/announcements/${id}`),
    enabled: !!id,
    retry: false,
  })
}

export function useMarkAnnouncementSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/api/announcements/${id}/seen`, { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(announcementKeys.pending, null)
      void qc.invalidateQueries({ queryKey: announcementKeys.pending })
      void qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useAdminAnnouncements() {
  return useQuery({ queryKey: announcementKeys.admin, queryFn: () => api<Announcement[]>('/api/admin/announcements') })
}

export type AnnouncementDraft = { title: string; body: string; image_url: string; link_url: string; cta_label: string; notify: boolean }

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: AnnouncementDraft) => api<Announcement>('/api/admin/announcements', { method: 'POST', json: d }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: announcementKeys.admin })
      void qc.invalidateQueries({ queryKey: announcementKeys.pending })
    },
  })
}

export function useSetAnnouncementActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api(`/api/admin/announcements/${id}`, { method: 'PATCH', json: { active } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: announcementKeys.admin }),
  })
}
