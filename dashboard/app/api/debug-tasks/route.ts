import { NextResponse } from "next/server";
import { supabase, hasSupabaseConfig, supabaseUrlPrefix } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseConfig) {
    return NextResponse.json(
      {
        ok: false,
        reason: "NO_SUPABASE_CONFIG",
        message: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
        supabaseUrlPrefix,
      },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, description, hospital_name, task_type, status, deadline, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          reason: "SUPABASE_ERROR",
          supabaseUrlPrefix,
          error: { message: error.message, details: error.details, code: error.code },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        supabaseUrlPrefix,
        count: Array.isArray(data) ? data.length : 0,
        sample: Array.isArray(data) ? data.slice(0, 10) : [],
      },
      { status: 200 }
    );
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      {
        ok: false,
        reason: "UNEXPECTED_ERROR",
        supabaseUrlPrefix,
        error: { message: err.message },
      },
      { status: 500 }
    );
  }
}

