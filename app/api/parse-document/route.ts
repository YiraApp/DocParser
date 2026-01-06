import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
	console.log("[API] Document parsing request received")

	try {
		const formData = await request.formData()
		const files = formData.getAll("files") as File[]
		const originalFileName = formData.get("originalFileName") as string

		if (!files || files.length === 0) {
			console.log("[API] ERROR: No files provided")
			return NextResponse.json({ error: "No files provided" }, { status: 400 })
		}

		console.log("[API] Files received:", files.length)

		// Validate file types
		const allowedTypes = ["image/png", "image/jpeg", "image/jpg"]
		for (const file of files) {
			if (!allowedTypes.includes(file.type)) {
				return NextResponse.json(
					{ error: "Only PNG, JPG, and JPEG images are supported" },
					{ status: 400 },
				)
			}
		}

		// TODO: Add MongoDB integration here
		// TODO: Add file storage logic here
		// TODO: Add document parsing logic here

		const response = {
			success: true,
			fileName: originalFileName,
			filesProcessed: files.length,
			message: "Document received. Ready for MongoDB integration.",
		}

		console.log("[API] Response:", response)
		return NextResponse.json(response)
	} catch (error) {
		console.error("[API] ERROR:", error)
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Unknown error occurred",
			},
			{ status: 500 },
		)
	}
}

export async function GET(request: NextRequest) {
	const id = request.nextUrl.searchParams.get("id")

	if (!id) {
		return NextResponse.json({ error: "No document ID provided" }, { status: 400 })
	}

	// TODO: Add MongoDB query logic here
	return NextResponse.json({
		message: "GET endpoint ready for MongoDB integration",
		documentId: id,
	})
}
