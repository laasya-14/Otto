import { useEffect, useMemo, useRef, useState } from "react";
import { MODELS } from "../lib/models";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

export function ModelPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = useMemo(() => MODELS.find((m) => m.id === value), [value]);

  const grouped = useMemo(() => {
    const byProvider: Record<string, typeof MODELS> = {};
    for (const m of MODELS) (byProvider[m.provider] ??= []).push(m);
    return Object.entries(byProvider);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className={`model-picker-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={current?.label ?? value}
      >
        <span className="model-picker-label">{current?.label ?? value}</span>
        <svg className="model-picker-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="model-picker-menu" role="listbox">
          {grouped.map(([provider, models]) => (
            <div key={provider} className="model-picker-group">
              <div className="model-picker-group-label">{PROVIDER_LABEL[provider] ?? provider}</div>
              {models.map((m) => {
                const selected = m.id === value;
                return (
                  <button
                    type="button"
                    key={m.id}
                    role="option"
                    aria-selected={selected}
                    className={`model-picker-item${selected ? " selected" : ""}`}
                    onClick={() => pick(m.id)}
                  >
                    <span className="model-picker-item-label">{m.label}</span>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M2.5 6.5l2.5 2.5L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface EffortProps {
  value: string;
  options: string[];
  onChange: (value: string | undefined) => void;
}

export function EffortPicker({ value, options, onChange }: EffortProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = ["", ...options];
  const labelFor = (v: string) => (v === "" ? "Default" : v[0].toUpperCase() + v.slice(1));

  function pick(v: string) {
    onChange(v === "" ? undefined : v);
    setOpen(false);
  }

  return (
    <div className="model-picker effort-picker" ref={rootRef}>
      <button
        type="button"
        className={`model-picker-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Reasoning effort"
      >
        <span className="model-picker-label">{labelFor(value)}</span>
        <svg className="model-picker-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="model-picker-menu effort-menu" role="listbox">
          {items.map((v) => {
            const selected = v === value;
            return (
              <button
                type="button"
                key={v || "default"}
                role="option"
                aria-selected={selected}
                className={`model-picker-item${selected ? " selected" : ""}`}
                onClick={() => pick(v)}
              >
                <span className="model-picker-item-label">{labelFor(v)}</span>
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 6.5l2.5 2.5L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
