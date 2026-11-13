export const STATUSES = ["candidate", "selected", "dropped"] as const;
export type Status = (typeof STATUSES)[number];

export type Item = {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  company: string;
  rating: number;
  status: Status;
  created_at: string;
  updated_at: string;
};

export type ItemInput = {
  title: string;
  summary: string;
  source_url: string;
  company: string;
  rating: number;
  status: Status;
};

export const ITEM_COLUMNS =
  "id::text as id, title, summary, source_url, company, rating, status, created_at, updated_at";

const LIMITS = { title: 200, summary: 600, source_url: 2000, company: 80 } as const;

type Parsed = { ok: true; value: Partial<ItemInput> } | { ok: false; error: string };

function text(body: Record<string, unknown>, key: keyof typeof LIMITS): string | undefined | Error {
  const raw = body[key];
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return new Error(`${key} must be a string`);
  const value = raw.trim();
  if (value.length > LIMITS[key]) return new Error(`${key} is too long (max ${LIMITS[key]})`);
  return value;
}

export function parseItem(body: unknown, { partial }: { partial: boolean }): Parsed {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const input = body as Record<string, unknown>;
  const value: Partial<ItemInput> = {};

  for (const key of ["title", "summary", "source_url", "company"] as const) {
    const parsed = text(input, key);
    if (parsed instanceof Error) return { ok: false, error: parsed.message };
    if (parsed !== undefined) value[key] = parsed;
  }

  if (value.title !== undefined && value.title === "") return { ok: false, error: "title is required" };
  if (!partial && value.title === undefined) return { ok: false, error: "title is required" };

  if (value.source_url) {
    try {
      const url = new URL(value.source_url);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
    } catch {
      return { ok: false, error: "source_url must be a valid http(s) URL" };
    }
  }

  if (input.rating !== undefined) {
    const rating = input.rating;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { ok: false, error: "rating must be an integer from 1 to 5" };
    }
    value.rating = rating;
  }

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !STATUSES.includes(input.status as Status)) {
      return { ok: false, error: `status must be one of ${STATUSES.join(", ")}` };
    }
    value.status = input.status as Status;
  }

  if (partial && Object.keys(value).length === 0) return { ok: false, error: "Nothing to update" };
  return { ok: true, value };
}
