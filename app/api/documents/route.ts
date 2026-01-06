import { type NextRequest, NextResponse } from "next/server"

// Static document database
const STATIC_DOCUMENTS = [
  {
    id: "doc-001",
    file_name: "Patient_Report_2024.pdf",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    structured_data: {
      patientInfo: {
        fullName: "John Doe",
        age: 45,
        gender: "Male",
        dateOfBirth: "1979-05-15"
      },
      documentInfo: {
        type: "Medical Report",
        reportDate: "2024-01-10"
      },
      providerInfo: {
        hospitalName: "City Medical Center",
        department: "Cardiology",
        doctorName: "Dr. Sarah Smith"
      }
    }
  },
  {
    id: "doc-002",
    file_name: "Lab_Results_2024.pdf",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    structured_data: {
      patientInfo: {
        fullName: "Jane Smith",
        age: 38,
        gender: "Female",
        dateOfBirth: "1986-08-22"
      },
      documentInfo: {
        type: "Lab Report",
        reportDate: "2024-01-08"
      },
      providerInfo: {
        hospitalName: "Advanced Diagnostics Lab",
        department: "Laboratory",
        doctorName: "Dr. Michael Johnson"
      }
    }
  }
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Number.parseInt(searchParams.get("limit") || "5")

    // Return static documents up to limit
    const documents = STATIC_DOCUMENTS.slice(0, limit)

    return NextResponse.json({ documents })
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
