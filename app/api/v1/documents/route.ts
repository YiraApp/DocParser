import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function authenticateTenant(apiKey: string | null) {
  if (!apiKey) {
    return { error: "Missing API key", status: 401 }
  }

  const supabase = await createClient()
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, is_active")
    .eq("api_key", apiKey)
    .single()

  if (error || !tenant || !tenant.is_active) {
    return { error: "Invalid or inactive API key", status: 401 }
  }

  return { tenant }
}

// Get document by ID
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("X-API-Key")
  const documentId = request.nextUrl.searchParams.get("id")

  const authResult = await authenticateTenant(apiKey)
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  if (!documentId) {
    return NextResponse.json({ error: "Missing document id parameter" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, user_name, file_name, document_type, parsed_fields, structured_data, confidence_score, created_at")
    .eq("id", documentId)
    .eq("tenant_id", authResult.tenant.id)
    .single()

  if (error || !document) {
    return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 })
  }

  return NextResponse.json({
    id: document.id,
    patient_name: document.user_name,
    file_name: document.file_name,
    document_type: document.document_type,
    confidence_score: document.confidence_score,
    created_at: document.created_at,
    fields: document.parsed_fields,
    structured_data: document.structured_data,
  })
}
