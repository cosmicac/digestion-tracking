import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DigestionEvent, EventInput } from "../shared/schema";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401 && path !== "/login") throw new UnauthorizedError();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  session: () => request<{ authenticated: boolean }>("/session"),
  login: (password: string) =>
    request<{ ok: true }>("/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),
  listEvents: () => request<DigestionEvent[]>("/events"),
  createEvent: (input: EventInput) =>
    request<DigestionEvent>("/events", { method: "POST", body: JSON.stringify(input) }),
  updateEvent: (id: string, input: EventInput) =>
    request<DigestionEvent>(`/events/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteEvent: (id: string) => request<{ ok: true }>(`/events/${id}`, { method: "DELETE" }),
};

export const sessionQuery = { queryKey: ["session"], queryFn: api.session, staleTime: 60_000 };
export const eventsQuery = { queryKey: ["events"], queryFn: api.listEvents };

export function useEvents() {
  return useQuery(eventsQuery);
}

export function useSaveEvent(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => (id ? api.updateEvent(id, input) : api.createEvent(input)),
    onSuccess: (saved) => {
      qc.setQueryData<DigestionEvent[]>(["events"], (old) => {
        if (!old) return old;
        const rest = old.filter((e) => e.id !== saved.id);
        return [saved, ...rest].sort(
          (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
        );
      });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: (_, id) => {
      qc.setQueryData<DigestionEvent[]>(["events"], (old) => old?.filter((e) => e.id !== id));
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
