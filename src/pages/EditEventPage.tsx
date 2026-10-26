import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { EVENT_TYPE_LABELS } from "../../shared/schema";
import { useDeleteEvent, useEvents } from "../api";
import { EventForm } from "../components/EventForm";
import { EVENT_STYLE } from "../lib/eventMeta";

const route = getRouteApi("/authed/events/$eventId");

export function EditEventPage() {
  const { eventId } = route.useParams();
  const navigate = useNavigate();
  const { data: events, isLoading } = useEvents();
  const del = useDeleteEvent();
  const event = events?.find((e) => e.id === eventId);

  if (isLoading) return <p className="py-8 text-center text-stone-500">Loading…</p>;
  if (!event) {
    return (
      <div className="py-8 text-center text-stone-500">
        Not found. <Link to="/" className="text-teal-700 underline">Back</Link>
      </div>
    );
  }

  async function onDelete() {
    if (!confirm("Delete this entry?")) return;
    try {
      await del.mutateAsync(eventId);
      navigate({ to: "/" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">
        {EVENT_STYLE[event.type].emoji} Edit {EVENT_TYPE_LABELS[event.type].toLowerCase()}
      </h1>
      <EventForm
        key={`${event.id}-${event.updatedAt}`}
        type={event.type}
        initial={event}
        onSaved={() => navigate({ to: "/" })}
      />
      <button
        onClick={onDelete}
        disabled={del.isPending}
        className="mt-4 w-full rounded-xl border border-red-200 py-3 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {del.isPending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
