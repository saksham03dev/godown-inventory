import { NextResponse } from "next/server";

/** Bootstrap is disabled — create admins via the Users page or database. */
export async function POST() {
  return NextResponse.json(
    { error: "Bootstrap is disabled. Contact your administrator." },
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json({ needsBootstrap: false });
}
