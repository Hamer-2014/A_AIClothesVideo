import type { JsonValue } from "@/lib/db/schema/common";
import {
  createAPIMartVideoGeneration,
  getAPIMartVideoConfig,
  pollAPIMartTask,
} from "@/lib/providers/apimart/video";
import {
  createEvoLinkVideoGeneration,
  getEvoLinkVideoConfig,
  pollEvoLinkTask,
} from "@/lib/providers/evolink/video";

export type VideoGenerationProvider = "evolink" | "apimart";

export interface VideoGenerationConfig {
  provider: VideoGenerationProvider;
  model: string;
}

export interface VideoGenerationInput {
  prompt: string;
  imageUrls: string[];
  aspectRatio: string;
}

export interface VideoGenerationResult {
  provider: VideoGenerationProvider;
  model: string;
  providerTaskId: string;
  raw: JsonValue;
}

export interface VideoTaskResult {
  provider: VideoGenerationProvider;
  model: string;
  providerTaskId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  outputUrl: string | null;
  errorMessage: string | null;
  raw: JsonValue;
}

interface VideoGenerationRouterDeps {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
}

interface VideoGenerationAdapter {
  getConfig: (env: Record<string, string | undefined>) => VideoGenerationConfig;
  create: (
    input: VideoGenerationInput,
    deps?: VideoGenerationRouterDeps,
  ) => Promise<VideoGenerationResult>;
  poll: (
    providerTaskId: string,
    deps?: VideoGenerationRouterDeps,
  ) => Promise<VideoTaskResult>;
}

export class UnsupportedVideoGenerationProviderError extends Error {
  constructor(provider: string) {
    super(`Unsupported video generation provider: ${provider}`);
    this.name = "UnsupportedVideoGenerationProviderError";
  }
}

function selectedProvider(env: Record<string, string | undefined>) {
  return (env.VIDEO_GENERATION_PROVIDER?.trim().toLowerCase() || "evolink");
}

const adapters: Record<VideoGenerationProvider, VideoGenerationAdapter> = {
  evolink: {
    getConfig(env) {
      const config = getEvoLinkVideoConfig(env);
      return {
        provider: "evolink",
        model: config.model,
      };
    },
    create: createEvoLinkVideoGeneration,
    poll: pollEvoLinkTask,
  },
  apimart: {
    getConfig(env) {
      const config = getAPIMartVideoConfig(env);
      return {
        provider: "apimart",
        model: config.model,
      };
    },
    create: createAPIMartVideoGeneration,
    poll: pollAPIMartTask,
  },
};

function getAdapter(provider: string) {
  const adapter = adapters[provider as VideoGenerationProvider];
  if (!adapter) {
    throw new UnsupportedVideoGenerationProviderError(provider);
  }

  return adapter;
}

export function getVideoGenerationConfig(
  env: Record<string, string | undefined> = process.env,
): VideoGenerationConfig {
  const provider = selectedProvider(env);
  return getAdapter(provider).getConfig(env);
}

export async function createVideoGeneration(
  input: VideoGenerationInput,
  deps: VideoGenerationRouterDeps = {},
): Promise<VideoGenerationResult> {
  const env = deps.env ?? process.env;
  const provider = selectedProvider(env);
  return getAdapter(provider).create(input, deps);
}

export async function pollVideoGenerationTask(
  providerTaskId: string,
  deps: VideoGenerationRouterDeps = {},
): Promise<VideoTaskResult> {
  const env = deps.env ?? process.env;
  const provider = selectedProvider(env);
  return getAdapter(provider).poll(providerTaskId, deps);
}

export async function pollVideoGenerationTaskForProvider(
  provider: VideoGenerationProvider,
  providerTaskId: string,
  deps: VideoGenerationRouterDeps = {},
): Promise<VideoTaskResult> {
  return getAdapter(provider).poll(providerTaskId, deps);
}
