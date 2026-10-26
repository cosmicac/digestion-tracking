import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { EVENT_TYPES, type EventType } from "../shared/schema";
import { sessionQuery } from "./api";
import { AppLayout } from "./components/AppLayout";
import { EditEventPage } from "./pages/EditEventPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NewEventPage } from "./pages/NewEventPage";

type RouterContext = { queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()();

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.fetchQuery(sessionQuery);
    if (session.authenticated) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

/** Layout route that requires a valid session for everything beneath it */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authed",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session.authenticated) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/",
  component: HomePage,
});

const newEventRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/log/$type",
  beforeLoad: ({ params }) => {
    if (!EVENT_TYPES.includes(params.type as EventType)) throw notFound();
  },
  component: NewEventPage,
});

const editEventRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/events/$eventId",
  component: EditEventPage,
});

const insightsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/insights",
  component: lazyRouteComponent(() => import("./pages/InsightsPage"), "InsightsPage"),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([homeRoute, newEventRoute, editEventRoute, insightsRoute]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultNotFoundComponent: () => (
      <div className="p-8 text-center text-stone-500">Page not found</div>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
