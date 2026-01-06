import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-context"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")

  console.log("[SEARCH] Search request received:", { query })

  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ documents: [] })
    }

    const db = await getDatabase()
    const documentsCollection = db.collection("documents")

    // Build search filter
    const searchFilter: any = {
      user_email: sessionUser.email,
      $or: [
        { file_name: { $regex: query, $options: "i" } },
        { file_type: { $regex: query, $options: "i" } },
      ],
    }

    const documents = await documentsCollection
      .find(searchFilter)
      .sort({ created_at: -1 })
      .limit(20)
      .toArray()

    console.log("[SEARCH] Found documents:", documents.length)

    return NextResponse.json({
      success: true,
      documents: documents.map((doc: any) => ({
        id: doc._id.toString(),
        file_name: doc.file_name,
        file_type: doc.file_type,
        file_size: doc.file_size,
        created_at: doc.created_at,
        status: doc.status,
      })),
      count: documents.length,
    })
  } catch (error) {
    console.error("[SEARCH] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed",
      },
      { status: 500 }
    )
  }
}
