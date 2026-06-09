import { NextResponse } from "next/server";
import { getRuntimeHealth } from "@/server/ops/health";

export function GET() {
  return NextResponse.json({
    ...getRuntimeHealth(),
    timestamp: new Date().toISOString(),
  });
}
