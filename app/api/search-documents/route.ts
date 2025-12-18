import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")

  console.log("[v0] Search request received:", { query })

  if (!query) {
    return NextResponse.json({ documents: [] })
  }

  const supabase = await createClient()

  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .or(
      `user_name.ilike.%${query}%,file_name.ilike.%${query}%,document_type.ilike.%${query}%,search_text.ilike.%${query}%`,
    )
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[v0] Search error:", error)
    return NextResponse.json({ error: "Failed to search documents", details: error.message }, { status: 500 })
  }

  console.log("[v0] Search results:", { count: documents?.length || 0 })

  return NextResponse.json({ documents: documents || [] })
}
