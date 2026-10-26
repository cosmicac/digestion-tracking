import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="font-medium text-stone-800">{label}</div>
        {hint && <div className="text-xs text-stone-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function Chip(props: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        props.selected
          ? "border-teal-700 bg-teal-700 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
      } ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function PrimaryButton(props: {
  pending?: boolean;
  pendingLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={props.pending}
      className="w-full rounded-xl bg-teal-700 py-4 text-lg font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
    >
      {props.pending ? (props.pendingLabel ?? "Saving…") : props.children}
    </button>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{children}</p>;
}
