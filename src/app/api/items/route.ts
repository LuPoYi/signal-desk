import { requireIdentity } from "../../../../cursor/identity";
import { fail, json, readJson } from "@/lib/api";
import { sql } from "@/lib/db";
import { ITEM_COLUMNS, parseItem, STATUSES, type Item } from "@/lib/items";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const company = params.get("company");
  if (status && !(STATUSES as readonly string[]).includes(status)) return fail("Invalid status", 400);

  const items = await sql<Item>(
    `select ${ITEM_COLUMNS} from items
     where ($1::text is null or status = $1)
       and ($2::text is null or lower(company) = lower($2))
     order by created_at desc, id desc`,
    [status || null, company || null],
  );
  const companies = await sql<{ company: string }>(
    "select distinct company from items where company <> '' order by company",
  );
  const counts = await sql<{ status: string; count: number }>(
    `select status, count(*)::int as count from items
     where ($1::text is null or lower(company) = lower($1))
     group by status`,
    [company || null],
  );
  return json({
    items,
    companies: companies.map((row) => row.company),
    counts: Object.fromEntries(counts.map((row) => [row.status, row.count])),
  });
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const parsed = parseItem(await readJson(request), { partial: false });
  if (!parsed.ok) return fail(parsed.error, 400);
  const v = parsed.value;

  const [item] = await sql<Item>(
    `insert into items (title, summary, source_url, company, rating, status, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning ${ITEM_COLUMNS}`,
    [v.title, v.summary ?? "", v.source_url ?? "", v.company ?? "", v.rating ?? 3, v.status ?? "candidate", identity.sub],
  );
  return json({ item }, 201);
}
