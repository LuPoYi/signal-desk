import { requireIdentity } from "../../../../../cursor/identity";
import { fail, json, readJson } from "@/lib/api";
import { sql } from "@/lib/db";
import { ITEM_COLUMNS, parseItem, type Item } from "@/lib/items";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function itemId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  return /^\d{1,18}$/.test(id) ? id : null;
}

export async function PATCH(request: Request, context: Context) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const id = await itemId(context);
  if (id === null) return fail("Invalid id", 400);
  const parsed = parseItem(await readJson(request), { partial: true });
  if (!parsed.ok) return fail(parsed.error, 400);

  const entries = Object.entries(parsed.value);
  const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
  const rows = await sql<Item>(
    `update items set ${assignments.join(", ")}, updated_at = now()
     where id = $1::bigint
     returning ${ITEM_COLUMNS}`,
    [id, ...entries.map(([, value]) => value)],
  );
  if (rows.length === 0) return fail("Not found", 404);
  return json({ item: rows[0] });
}

export async function DELETE(request: Request, context: Context) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const id = await itemId(context);
  if (id === null) return fail("Invalid id", 400);
  const rows = await sql("delete from items where id = $1::bigint returning id", [id]);
  if (rows.length === 0) return fail("Not found", 404);
  return new Response(null, { status: 204, headers: { "cache-control": "private, no-store" } });
}
