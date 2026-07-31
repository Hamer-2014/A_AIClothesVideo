import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { appearancePacks, garmentFidelityResults } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { AppearanceView } from "./config";

export type QaResult = { verdict: string; [key: string]: JsonValue };
export interface VirtualTryOnQaStore {
  upsertViewResult(packId: string, view: AppearanceView, result: QaResult, providerCallLogId?: string | null): Promise<void>;
  upsertCrossResult(packId: string, result: QaResult, providerCallLogId?: string | null): Promise<void>;
  updateQaSummary(packId: string, summary: JsonValue): Promise<void>;
  findResults(packId: string): Promise<Array<{ scope: string; view: AppearanceView | null; result: QaResult }>>;
}

export function createInMemoryVirtualTryOnQaStore(): VirtualTryOnQaStore & { getQaSummary(packId: string): JsonValue | null } {
  const values = new Map<string, { scope: string; view: AppearanceView | null; result: QaResult }>(); const summaries = new Map<string, JsonValue>();
  const key = (packId: string, scope: string, view: AppearanceView | null) => packId + ":" + scope + ":" + (view ?? "cross");
  return { async upsertViewResult(packId, view, result) { values.set(key(packId, "view", view), { scope: "view", view, result }); }, async upsertCrossResult(packId, result) { values.set(key(packId, "cross_view", null), { scope: "cross_view", view: null, result }); }, async updateQaSummary(packId, summary) { summaries.set(packId, summary); }, async findResults(packId) { return Array.from(values.entries()).filter(([item]) => item.startsWith(packId + ":")).map(([, item]) => item); }, getQaSummary(packId) { return summaries.get(packId) ?? null; } };
}

export function createDrizzleVirtualTryOnQaStore(db = getDb()): VirtualTryOnQaStore {
  return {
    async upsertViewResult(packId, view, result, providerCallLogId = null) { await db.insert(garmentFidelityResults).values({ appearancePackId: packId, scope: "view", view, verdict: result.verdict, resultJson: result, providerCallLogId }).onConflictDoUpdate({ target: [garmentFidelityResults.appearancePackId, garmentFidelityResults.scope, garmentFidelityResults.view], targetWhere: eq(garmentFidelityResults.view, view), set: { verdict: result.verdict, resultJson: result, providerCallLogId, updatedAt: new Date() } }); },
    async upsertCrossResult(packId, result, providerCallLogId = null) { await db.insert(garmentFidelityResults).values({ appearancePackId: packId, scope: "cross_view", view: null, verdict: result.verdict, resultJson: result, providerCallLogId }).onConflictDoUpdate({ target: [garmentFidelityResults.appearancePackId, garmentFidelityResults.scope], targetWhere: isNull(garmentFidelityResults.view), set: { verdict: result.verdict, resultJson: result, providerCallLogId, updatedAt: new Date() } }); },
    async updateQaSummary(packId, summary) { await db.update(appearancePacks).set({ qaSummary: summary, updatedAt: new Date() }).where(eq(appearancePacks.id, packId)); },
    async findResults(packId) { const rows = await db.select().from(garmentFidelityResults).where(eq(garmentFidelityResults.appearancePackId, packId)); return rows.map((item) => ({ scope: item.scope, view: item.view, result: item.resultJson as QaResult })); },
  };
}
