import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { EVENT_TYPE_LABELS, type EventType } from "../../shared/schema";
import { EventForm } from "../components/EventForm";
import { EVENT_STYLE } from "../lib/eventMeta";

const route = getRouteApi("/authed/log/$type");

export function NewEventPage() {
  const { type } = route.useParams() as { type: EventType };
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">
        {EVENT_STYLE[type].emoji} Log {EVENT_TYPE_LABELS[type].toLowerCase()}
      </h1>
      <EventForm key={type} type={type} onSaved={() => navigate({ to: "/" })} />
    </div>
  );
}
