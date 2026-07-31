import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  appearancePackAssets,
  appearancePacks,
  garmentFidelityResults,
  providerCallLogs,
  virtualTryonJobs,
  virtualTryonStateEvents,
} from "@/lib/db/schema";

const MAX_PAGE_SIZE = 50;
const R2_KEY_PREFIX = "virtual-try-on/";

type Mode = "front_only" | "three_view";
type RequiredView = "front" | "side" | "back";

type ListCursor = { createdAt: Date; id: string };

type AdminVirtualTryOnJob = {
  id: string;
  userId: string;
  mode: Mode;
  status: string;
  skuName: string | null;
  creditCost: number;
  reservedLedgerId: string | null;
  capturedLedgerId: string | null;
  releasedLedgerId: string | null;
  refundedLedgerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AdminVirtualTryOnPack = {
  id: string;
  jobId: string;
  version: number;
  status: string;
  requiredViews: unknown;
  qaSummary?: unknown;
  lockedAt?: Date | null;
};

type AdminVirtualTryOnAsset = {
  id: string;
  packId: string;
  view: RequiredView;
  providerStatus: string;
  attemptCount: number;
  lastErrorCode: string | null;
  r2Key: string | null;
  origin: string;
  provenance: unknown;
};

type AdminVirtualTryOnFidelity = {
  id: string;
  packId: string;
  scope: string;
  view: RequiredView | null;
  verdict: string;
  resultJson: unknown;
};

type AdminVirtualTryOnProviderLog = {
  id: string;
  jobId: string | null;
  provider: string;
  model: string;
  purpose: string;
  status: string;
  costEstimate: string | null;
  providerTaskId: string | null;
  errorCode: string | null;
  errorMessage?: string | null;
  requestSnapshot?: unknown;
  responseSummary?: unknown;
};

type AdminVirtualTryOnStateEvent = {
  id: string;
  jobId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string;
  actorType: string;
  eventSnapshot: unknown;
  createdAt: Date;
};

export type AdminVirtualTryOnListItem = {
  id: string;
  userId: string;
  mode: Mode;
  status: string;
  pack: { version: number; requiredViews: RequiredView[] } | null;
  createdAt: Date;
};

export type AdminVirtualTryOnDetail = {
  job: Pick<AdminVirtualTryOnJob, "id" | "userId" | "mode" | "status" | "skuName" | "creditCost" | "createdAt" | "updatedAt">;
  pack: { id: string; version: number; status: string; requiredViews: RequiredView[]; qaSummary: unknown; lockedAt: Date | null };
  views: Array<Omit<AdminVirtualTryOnAsset, "packId" | "r2Key"> & { r2KeySuffix: string | null; provenance: unknown }>;
  fidelity: Array<Omit<AdminVirtualTryOnFidelity, "packId"> & { resultJson: unknown }>;
  providerLogs: Array<Pick<AdminVirtualTryOnProviderLog, "id" | "provider" | "model" | "purpose" | "status" | "costEstimate" | "providerTaskId" | "errorCode">>;
  ledger: { reservedLedgerId: string | null; capturedLedgerId: string | null; releasedLedgerId: string | null; refundedLedgerId: string | null };
  stateEvents: Array<Omit<AdminVirtualTryOnStateEvent, "jobId" | "eventSnapshot"> & { eventSnapshot: unknown }>;
};

export interface AdminVirtualTryOnStore {
  listJobs(input: { limit: number; cursor: ListCursor | null }): Promise<Array<AdminVirtualTryOnJob & { pack: AdminVirtualTryOnPack | null }>>;
  findDetail(jobId: string): Promise<{
    job: AdminVirtualTryOnJob;
    pack: AdminVirtualTryOnPack;
    assets: AdminVirtualTryOnAsset[];
    fidelity: AdminVirtualTryOnFidelity[];
    providerLogs: AdminVirtualTryOnProviderLog[];
    stateEvents: AdminVirtualTryOnStateEvent[];
  } | null>;
}

function requiredViews(value: unknown): RequiredView[] {
  if (!Array.isArray(value)) return [];
  return value.filter((view): view is RequiredView => view === "front" || view === "side" || view === "back");
}

function stableCode(value: string | null | undefined) {
  return value && /^[a-z0-9_.:-]{1,120}$/iu.test(value) ? value : null;
}

function safeJson(value: unknown): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return /https?:\/\//iu.test(value) || /(?:api[_-]?key|x-amz-|signature|signed)/iu.test(value) || value.includes(R2_KEY_PREFIX)
      ? undefined
      : value;
  }
  if (Array.isArray(value)) return value.map(safeJson).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    if (/(?:api[_-]?key|url|key|signature|raw)/iu.test(key)) return [];
    const sanitized = safeJson(nested);
    return sanitized === undefined ? [] : [[key, sanitized]];
  }));
}

function safeText(value: string | null | undefined) {
  const sanitized = safeJson(value);
  return typeof sanitized === "string" ? sanitized : null;
}

function r2KeySuffix(key: string | null) {
  if (!key || /https?:\/\//iu.test(key)) return null;
  const parts = key.split("/").filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join("/") : null;
}

function parseCursor(value: string | undefined): ListCursor | null {
  if (!value) return null;
  const [milliseconds, id] = value.split("|", 2);
  const createdAt = new Date(Number(milliseconds));
  return Number.isFinite(createdAt.getTime()) && id && /^[a-z0-9-]{1,128}$/iu.test(id) ? { createdAt, id } : null;
}

function formatCursor(job: AdminVirtualTryOnJob) {
  return `${job.createdAt.getTime()}|${job.id}`;
}

function normalizeLimit(limit: number | undefined) {
  return Number.isInteger(limit) && limit && limit > 0 ? Math.min(limit, MAX_PAGE_SIZE) : 25;
}

export async function listAdminVirtualTryOns({ store, limit, cursor }: { store: AdminVirtualTryOnStore; limit?: number; cursor?: string }) {
  const normalizedLimit = normalizeLimit(limit);
  const jobs = await store.listJobs({ limit: normalizedLimit + 1, cursor: parseCursor(cursor) });
  const page = jobs.slice(0, normalizedLimit);
  return {
    items: page.map((job): AdminVirtualTryOnListItem => ({
      id: job.id,
      userId: safeText(job.userId) ?? "redacted",
      mode: job.mode,
      status: stableCode(job.status) ?? "unknown",
      pack: job.pack ? { version: job.pack.version, requiredViews: requiredViews(job.pack.requiredViews) } : null,
      createdAt: job.createdAt,
    })),
    nextCursor: jobs.length > normalizedLimit && page.at(-1) ? formatCursor(page.at(-1)!) : null,
  };
}

export async function getAdminVirtualTryOnDetail({ store, jobId }: { store: AdminVirtualTryOnStore; jobId: string }): Promise<AdminVirtualTryOnDetail | null> {
  const record = await store.findDetail(jobId);
  if (!record) return null;
  return {
    job: {
      id: record.job.id,
      userId: safeText(record.job.userId) ?? "redacted",
      mode: record.job.mode,
      status: stableCode(record.job.status) ?? "unknown",
      skuName: safeText(record.job.skuName),
      creditCost: record.job.creditCost,
      createdAt: record.job.createdAt,
      updatedAt: record.job.updatedAt,
    },
    pack: {
      id: record.pack.id,
      version: record.pack.version,
      status: stableCode(record.pack.status) ?? "unknown",
      requiredViews: requiredViews(record.pack.requiredViews),
      qaSummary: safeJson(record.pack.qaSummary) ?? null,
      lockedAt: record.pack.lockedAt ?? null,
    },
    views: record.assets.map((asset) => ({
      id: asset.id,
      view: asset.view,
      providerStatus: stableCode(asset.providerStatus) ?? "unknown",
      attemptCount: asset.attemptCount,
      lastErrorCode: stableCode(asset.lastErrorCode),
      r2KeySuffix: r2KeySuffix(asset.r2Key),
      origin: stableCode(asset.origin) ?? "unknown",
      provenance: safeJson(asset.provenance) ?? null,
    })),
    fidelity: record.fidelity.map((result) => ({
      id: result.id,
      scope: stableCode(result.scope) ?? "unknown",
      view: result.view,
      verdict: stableCode(result.verdict) ?? "unknown",
      resultJson: safeJson(result.resultJson) ?? null,
    })),
    providerLogs: record.providerLogs.map((log) => ({
      id: log.id,
      provider: stableCode(log.provider) ?? "unknown",
      model: stableCode(log.model) ?? "unknown",
      purpose: stableCode(log.purpose) ?? "unknown",
      status: stableCode(log.status) ?? "unknown",
      costEstimate: log.costEstimate,
      providerTaskId: stableCode(log.providerTaskId),
      errorCode: stableCode(log.errorCode),
    })),
    ledger: {
      reservedLedgerId: record.job.reservedLedgerId,
      capturedLedgerId: record.job.capturedLedgerId,
      releasedLedgerId: record.job.releasedLedgerId,
      refundedLedgerId: record.job.refundedLedgerId,
    },
    stateEvents: record.stateEvents.map((event) => ({
      id: event.id,
      fromStatus: stableCode(event.fromStatus),
      toStatus: stableCode(event.toStatus) ?? "unknown",
      reason: stableCode(event.reason) ?? "unknown",
      actorType: stableCode(event.actorType) ?? "system",
      eventSnapshot: safeJson(event.eventSnapshot) ?? null,
      createdAt: event.createdAt,
    })),
  };
}

export function createInMemoryAdminVirtualTryOnStore(initial: {
  jobs?: AdminVirtualTryOnJob[];
  packs?: AdminVirtualTryOnPack[];
  assets?: AdminVirtualTryOnAsset[];
  fidelity?: AdminVirtualTryOnFidelity[];
  providerLogs?: AdminVirtualTryOnProviderLog[];
  stateEvents?: AdminVirtualTryOnStateEvent[];
} = {}): AdminVirtualTryOnStore {
  const jobs = initial.jobs ?? [];
  const packs = initial.packs ?? [];
  const assets = initial.assets ?? [];
  const fidelity = initial.fidelity ?? [];
  const providerLogs = initial.providerLogs ?? [];
  const stateEvents = initial.stateEvents ?? [];
  const currentPack = (jobId: string) => packs.filter((pack) => pack.jobId === jobId).sort((left, right) => right.version - left.version)[0] ?? null;

  return {
    async listJobs({ limit, cursor }) {
      return jobs
        .slice()
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id))
        .filter((job) => !cursor || job.createdAt < cursor.createdAt || (job.createdAt.getTime() === cursor.createdAt.getTime() && job.id < cursor.id))
        .slice(0, limit)
        .map((job) => ({ ...job, pack: currentPack(job.id) }));
    },
    async findDetail(jobId) {
      const job = jobs.find((item) => item.id === jobId);
      const pack = job ? currentPack(job.id) : null;
      if (!job || !pack) return null;
      return {
        job,
        pack,
        assets: assets.filter((asset) => asset.packId === pack.id),
        fidelity: fidelity.filter((result) => result.packId === pack.id),
        providerLogs: providerLogs.filter((log) => log.jobId === job.id),
        stateEvents: stateEvents.filter((event) => event.jobId === job.id),
      };
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminVirtualTryOnStore(db: DbClient = getDb()): AdminVirtualTryOnStore {
  return {
    async listJobs({ limit, cursor }) {
      const cursorWhere = cursor
        ? or(lt(virtualTryonJobs.createdAt, cursor.createdAt), and(eq(virtualTryonJobs.createdAt, cursor.createdAt), lt(virtualTryonJobs.id, cursor.id)))
        : undefined;
      const jobs = await db.select({
        id: virtualTryonJobs.id,
        userId: virtualTryonJobs.userId,
        mode: virtualTryonJobs.mode,
        status: virtualTryonJobs.status,
        skuName: virtualTryonJobs.skuName,
        creditCost: virtualTryonJobs.creditCost,
        reservedLedgerId: virtualTryonJobs.reservedLedgerId,
        capturedLedgerId: virtualTryonJobs.capturedLedgerId,
        releasedLedgerId: virtualTryonJobs.releasedLedgerId,
        refundedLedgerId: virtualTryonJobs.refundedLedgerId,
        createdAt: virtualTryonJobs.createdAt,
        updatedAt: virtualTryonJobs.updatedAt,
      }).from(virtualTryonJobs).where(and(isNull(virtualTryonJobs.deletedAt), cursorWhere)).orderBy(desc(virtualTryonJobs.createdAt), desc(virtualTryonJobs.id)).limit(limit);
      const jobIds = jobs.map((job) => job.id);
      const packs = jobIds.length === 0 ? [] : await db.select({
        id: appearancePacks.id,
        jobId: appearancePacks.virtualTryonJobId,
        version: appearancePacks.version,
        status: appearancePacks.status,
        requiredViews: appearancePacks.requiredViews,
      }).from(appearancePacks).where(inArray(appearancePacks.virtualTryonJobId, jobIds));
      const packsByJob = new Map<string, AdminVirtualTryOnPack>();
      for (const pack of packs) {
        const current = packsByJob.get(pack.jobId);
        if (!current || pack.version > current.version) packsByJob.set(pack.jobId, pack);
      }
      return jobs.map((job) => ({ ...job, pack: packsByJob.get(job.id) ?? null }));
    },
    async findDetail(jobId) {
      const [job] = await db.select({
        id: virtualTryonJobs.id,
        userId: virtualTryonJobs.userId,
        mode: virtualTryonJobs.mode,
        status: virtualTryonJobs.status,
        skuName: virtualTryonJobs.skuName,
        creditCost: virtualTryonJobs.creditCost,
        reservedLedgerId: virtualTryonJobs.reservedLedgerId,
        capturedLedgerId: virtualTryonJobs.capturedLedgerId,
        releasedLedgerId: virtualTryonJobs.releasedLedgerId,
        refundedLedgerId: virtualTryonJobs.refundedLedgerId,
        createdAt: virtualTryonJobs.createdAt,
        updatedAt: virtualTryonJobs.updatedAt,
      }).from(virtualTryonJobs).where(and(eq(virtualTryonJobs.id, jobId), isNull(virtualTryonJobs.deletedAt))).limit(1);
      if (!job) return null;
      const [pack] = await db.select({
        id: appearancePacks.id,
        jobId: appearancePacks.virtualTryonJobId,
        version: appearancePacks.version,
        status: appearancePacks.status,
        requiredViews: appearancePacks.requiredViews,
        qaSummary: appearancePacks.qaSummary,
        lockedAt: appearancePacks.lockedAt,
      }).from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, job.id)).orderBy(desc(appearancePacks.version)).limit(1);
      if (!pack) return null;
      const [assets, fidelity, logs, stateEvents] = await Promise.all([
        db.select({ id: appearancePackAssets.id, packId: appearancePackAssets.appearancePackId, view: appearancePackAssets.view, providerStatus: appearancePackAssets.providerStatus, attemptCount: appearancePackAssets.attemptCount, lastErrorCode: appearancePackAssets.lastErrorCode, r2Key: appearancePackAssets.r2Key, origin: appearancePackAssets.origin, provenance: appearancePackAssets.provenance }).from(appearancePackAssets).where(eq(appearancePackAssets.appearancePackId, pack.id)),
        db.select({ id: garmentFidelityResults.id, packId: garmentFidelityResults.appearancePackId, scope: garmentFidelityResults.scope, view: garmentFidelityResults.view, verdict: garmentFidelityResults.verdict, resultJson: garmentFidelityResults.resultJson }).from(garmentFidelityResults).where(eq(garmentFidelityResults.appearancePackId, pack.id)),
        db.select({ id: providerCallLogs.id, jobId: providerCallLogs.virtualTryonJobId, provider: providerCallLogs.provider, model: providerCallLogs.model, purpose: providerCallLogs.purpose, status: providerCallLogs.status, costEstimate: providerCallLogs.costEstimate, providerTaskId: providerCallLogs.providerTaskId, errorCode: providerCallLogs.errorCode }).from(providerCallLogs).where(eq(providerCallLogs.virtualTryonJobId, job.id)).orderBy(desc(providerCallLogs.createdAt)),
        db.select({ id: virtualTryonStateEvents.id, jobId: virtualTryonStateEvents.virtualTryonJobId, fromStatus: virtualTryonStateEvents.fromStatus, toStatus: virtualTryonStateEvents.toStatus, reason: virtualTryonStateEvents.reason, actorType: virtualTryonStateEvents.actorType, eventSnapshot: virtualTryonStateEvents.eventSnapshot, createdAt: virtualTryonStateEvents.createdAt }).from(virtualTryonStateEvents).where(eq(virtualTryonStateEvents.virtualTryonJobId, job.id)).orderBy(desc(virtualTryonStateEvents.createdAt)),
      ]);
      return { job, pack, assets, fidelity, providerLogs: logs, stateEvents };
    },
  };
}
