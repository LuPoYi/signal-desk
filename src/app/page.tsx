import { headers } from "next/headers";
import { getIdentity } from "../../cursor/identity";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const identity = await getIdentity(await headers());
  const viewer = identity.verified ? identity.name || identity.email || "" : null;
  return <Dashboard viewer={viewer} />;
}
