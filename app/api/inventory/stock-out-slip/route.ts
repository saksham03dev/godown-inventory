import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import {
  fetchStockOutSlipByIdServer,
  fetchStockOutSlipsServer,
  updateStockOutSlipServer,
} from "@/lib/services/server/stockOutSlipService";

export async function GET(request: Request) {
  const auth = await requireSession({ permission: "slips.view" });
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      const slip = await fetchStockOutSlipByIdServer(id);
      if (!slip) {
        return NextResponse.json(
          { success: false, message: "Slip not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, message: "OK", data: slip });
    }

    const limit = Number(searchParams.get("limit") ?? 50);
    const slips = await fetchStockOutSlipsServer(limit);
    return NextResponse.json({ success: true, message: "OK", data: slips });
  } catch (err) {
    console.error("Stock-out slips list error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to load slips.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSession({ permission: "slips.edit" });
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Slip id is required." },
        { status: 400 }
      );
    }

    const result = await updateStockOutSlipServer(id, {
      billerName: body.billerName,
      billNo: body.billNo,
      units: Array.isArray(body.units) ? body.units : undefined,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err) {
    console.error("Stock-out slip patch error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to update slip.",
      },
      { status: 500 }
    );
  }
}
