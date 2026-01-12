import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/db"
import { getSessionUser } from "@/lib/auth-server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  console.log("[ADMIN] Account creation request received")

  try {
    // Verify admin access
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in" },
        { status: 401 }
      )
    }

    if (!sessionUser.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only admins can create accounts" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, role } = body

    // Validate input
    if (!email || !password || !    role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      )
    }

    if (!["admin", "user"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'admin' or 'user'" },
        { status: 400 }
      )
    }

    if (!["active", "inactive", "suspended"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const accountsCollection = db.collection("accounts")

    // Check if account already exists
    const existingAccount = await accountsCollection.findOne({ email })
    if (existingAccount) {
      return NextResponse.json(
        { error: "Account with this email already exists" },
        { status: 409 }
      )
    }

    // Create new account
    const accountRecord = {
      email,
      role,
      status,
      created_by: sessionUser.email,
      created_at: new Date(),
      updated_at: new Date(),
      upload_limit: role === "admin" ? null : 10,
      upload_count: 0,
    }

    const result = await accountsCollection.insertOne(accountRecord)

    console.log("[ADMIN] Account created:", { id: result.insertedId, email, role })

    return NextResponse.json(
      {
        success: true,
        account_id: result.insertedId.toString(),
        email,
        role,
        status,
        upload_limit: accountRecord.upload_limit,
        message: `${role} account created successfully`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[ADMIN] Error creating account:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Account creation failed",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  console.log("[ADMIN] Fetching accounts")

  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!sessionUser.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      )
    }

    const db = await getDatabase()
    const accountsCollection = db.collection("accounts")

    const accounts = await accountsCollection
      .find({})
      .project({ _id: 1, email: 1, role: 1, status: 1, created_at: 1, upload_count: 1, upload_limit: 1 })
      .sort({ created_at: -1 })
      .toArray()

    return NextResponse.json(
      {
        success: true,
        accounts: accounts.map((acc: any) => ({
          id: acc._id.toString(),
          email: acc.email,
          role: acc.role,
          status: acc.status,
          created_at: acc.created_at,
          upload_count: acc.upload_count,
          upload_limit: acc.upload_limit,
        })),
        count: accounts.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[ADMIN] Error fetching accounts:", error)
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  console.log("[ADMIN] Account deletion request")

  try {
    const sessionUser = await getSessionUser(request)
    if (!sessionUser || !sessionUser.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const accountsCollection = db.collection("accounts")

    const result = await accountsCollection.deleteOne({ email })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      )
    }

    console.log("[ADMIN] Account deleted:", email)

    return NextResponse.json(
      { success: true, message: "Account deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("[ADMIN] Error deleting account:", error)
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    )
  }
}