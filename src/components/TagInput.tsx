import { useId, useMemo, useState } from "react";

const FREQUENT_COUNT = 10;

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
};

/** Free-text tag input with autocomplete. Enter or comma adds a tag. */
export function TagInput({ value, onChange, suggestions, placeholder }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const listId = useId();

  const lowerValue = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !lowerValue.has(s.toLowerCase()))
      .slice(0, 8);
  }, [text, suggestions, lowerValue]);

  // Most-used ingredients not already added, shown as one-tap chips
  const frequent = useMemo(
    () => suggestions.filter((s) => !lowerValue.has(s.toLowerCase())).slice(0, FREQUENT_COUNT),
    [suggestions, lowerValue],
  );

  function add(raw: string) {
    const tags = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !lowerValue.has(t));
    if (tags.length) onChange([...value, ...new Set(tags)]);
    setText("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 rounded-lg border border-stone-300 bg-white p-2 focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-teal-100 py-1 pr-1 pl-3 text-sm text-teal-900"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-teal-700 hover:bg-teal-200"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so a click on a suggestion registers first
            setTimeout(() => setFocused(false), 150);
            if (text.trim()) add(text);
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 outline-none"
          aria-autocomplete="list"
          aria-controls={listId}
          enterKeyHint="enter"
          autoCapitalize="none"
        />
      </div>
      {focused && matches.length > 0 && (
        <ul
          id={listId}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg"
        >
          {matches.map((m) => (
            <li key={m}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(m)}
                className="w-full px-3 py-2 text-left hover:bg-stone-100"
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-stone-500">Press Enter or comma to add.</p>
      {frequent.length > 0 && !text.trim() && (
        <div className="mt-2">
          <div className="mb-1.5 text-xs font-medium text-stone-500">Frequently used</div>
          <div className="flex flex-wrap gap-1.5">
            {frequent.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s)}
                className="rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-700 hover:bg-stone-100 active:bg-stone-200"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
