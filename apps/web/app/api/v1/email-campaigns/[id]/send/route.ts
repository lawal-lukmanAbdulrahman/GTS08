import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const notImplemented = () =>
  NextResponse.json(
    { error: "Not implemented", code: "NOT_IMPLEMENTED" },
    { status: 501 }
  );

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  return notImplemented();
}
