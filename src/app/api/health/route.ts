import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "a-runwaytools",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  });
}
