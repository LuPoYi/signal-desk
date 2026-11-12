"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { STATUSES, type Item, type ItemInput, type Status } from "@/lib/items";

type Data = { items: Item[]; companies: string[]; counts: Partial<Record<Status, number>> };
type Draft = Omit<ItemInput, "rating"> & { rating: number };

const STATUS_LABEL: Record<Status, string> = {
  candidate: "Candidate",
  selected: "Selected",
  dropped: "Dropped",
};

const EMPTY_DRAFT: Draft = {
  title: "",
  summary: "",
  source_url: "",
  company: "",
  rating: 3,
  status: "candidate",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

function Stars({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}) {
  return (
    <span className="stars" role={onChange ? "radiogroup" : "img"} aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <svg width={size} height={size} viewBox="0 0 24 24" className={n <= value ? "star on" : "star"}>
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
          </svg>
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="star-btn"
            onClick={() => onChange(n)}
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ItemForm({
  initial,
  companies,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  companies: string[];
  submitLabel: string;
  onSubmit: (draft: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>Title</span>
        <input
          autoFocus
          required
          maxLength={200}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="What happened?"
        />
      </label>
      <label className="field">
        <span>Summary</span>
        <textarea
          rows={3}
          maxLength={600}
          value={draft.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="One or two lines on why it matters"
        />
      </label>
      <div className="row">
        <label className="field">
          <span>Company</span>
          <input
            list="company-options"
            maxLength={80}
            value={draft.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="OpenAI, Anthropic, ..."
          />
          <datalist id="company-options">
            {companies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Source URL</span>
          <input
            type="url"
            maxLength={2000}
            value={draft.source_url}
            onChange={(e) => set("source_url", e.target.value)}
            placeholder="https://"
          />
        </label>
      </div>
      <div className="row">
        <div className="field">
          <span>Rating</span>
          <Stars value={draft.rating} onChange={(v) => set("rating", v)} size={24} />
        </div>
        <label className="field">
          <span>Status</span>
          <select value={draft.status} onChange={(e) => set("status", e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Dashboard({ viewer }: { viewer: string | null }) {
  const [status, setStatus] = useState<Status | "all">("all");
  const [company, setCompany] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (status !== "all") query.set("status", status);
    if (company) query.set("company", company);
    try {
      setData(await api<Data>(`/api/items?${query}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [status, company]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => STATUSES.reduce((sum, s) => sum + (data?.counts[s] ?? 0), 0),
    [data],
  );

  async function save(draft: Draft) {
    if (editing === "new") {
      await api("/api/items", { method: "POST", body: JSON.stringify(draft) });
    } else if (editing) {
      await api(`/api/items/${editing.id}`, { method: "PATCH", body: JSON.stringify(draft) });
    }
    setEditing(null);
    await load();
  }

  async function patch(item: Item, changes: Partial<ItemInput>) {
    setData((d) =>
      d && { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, ...changes } : i)) },
    );
    try {
      await api(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify(changes) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
    await load();
  }

  async function remove(item: Item) {
    setConfirmDelete(null);
    try {
      await api(`/api/items/${item.id}`, { method: "DELETE" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
    await load();
  }

  const companies = data?.companies ?? [];

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1>Signal Desk</h1>
          <p className="muted">Weekly AI news candidates{viewer ? ` · ${viewer}` : ""}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing("new")}>
          + Add item
        </button>
      </header>

      <section className="filters">
        <div className="tabs" role="tablist">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              className={status === s ? "tab active" : "tab"}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
              <span className="count">{s === "all" ? total : (data?.counts[s] ?? 0)}</span>
            </button>
          ))}
        </div>
        <select
          className="company-filter"
          aria-label="Filter by company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">All companies</option>
          {company && !companies.includes(company) && <option value={company}>{company}</option>}
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </section>

      {error && <p className="error banner">{error}</p>}

      {data === null && !error && <p className="muted empty">Loading...</p>}
      {data?.items.length === 0 && (
        <div className="empty">
          <p>{status === "all" && !company ? "No items yet." : "Nothing matches these filters."}</p>
          {status === "all" && !company && (
            <button className="btn primary" onClick={() => setEditing("new")}>
              Add the first candidate
            </button>
          )}
        </div>
      )}

      <ul className="list">
        {data?.items.map((item) => (
          <li key={item.id} className={`card ${item.status}`}>
            <div className="card-main">
              <div className="meta">
                {item.company && <span className="chip">{item.company}</span>}
                <span className={`badge ${item.status}`}>{STATUS_LABEL[item.status]}</span>
              </div>
              <h3>{item.title}</h3>
              {item.summary && <p className="summary">{item.summary}</p>}
              <div className="foot">
                <Stars value={item.rating} onChange={(rating) => void patch(item, { rating })} size={16} />
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="source">
                    {hostname(item.source_url)} ↗
                  </a>
                )}
              </div>
            </div>
            <div className="card-actions">
              {STATUSES.filter((s) => s !== item.status).map((s) => (
                <button key={s} className="btn small" onClick={() => void patch(item, { status: s })}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
              <button className="btn small ghost" onClick={() => setEditing(item)}>
                Edit
              </button>
              <button className="btn small danger" onClick={() => setConfirmDelete(item)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <Modal title={editing === "new" ? "Add item" : "Edit item"} onClose={() => setEditing(null)}>
          <ItemForm
            initial={
              editing === "new"
                ? { ...EMPTY_DRAFT, company: company }
                : {
                    title: editing.title,
                    summary: editing.summary,
                    source_url: editing.source_url,
                    company: editing.company,
                    rating: editing.rating,
                    status: editing.status,
                  }
            }
            companies={companies}
            submitLabel={editing === "new" ? "Add item" : "Save changes"}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete item?" onClose={() => setConfirmDelete(null)}>
          <p className="muted">&ldquo;{confirmDelete.title}&rdquo; will be permanently removed.</p>
          <div className="actions">
            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button className="btn danger solid" onClick={() => void remove(confirmDelete)}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
