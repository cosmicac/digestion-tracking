import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { api } from "../api";

export function AppLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function logout() {
    await api.logout().catch(() => {});
    qc.clear();
    navigate({ to: "/login" });
  }

  const tab =
    "flex-1 py-3 text-center text-sm font-medium text-stone-500 [&.active]:text-teal-700";

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-lg font-semibold text-teal-800">
          🌿 Digestion Tracker
        </Link>
        <button onClick={logout} className="text-sm text-stone-500 hover:text-stone-800">
          Log out
        </button>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl">
          <Link to="/" className={tab} activeOptions={{ exact: true }}>
            Timeline
          </Link>
          <Link to="/insights" className={tab}>
            Insights
          </Link>
        </div>
      </nav>
    </div>
  );
}
