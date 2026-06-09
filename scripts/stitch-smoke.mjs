#!/usr/bin/env node

process.env.SMOKE_MODE ??= "stitch";

await import("./backend-smoke.mjs");
