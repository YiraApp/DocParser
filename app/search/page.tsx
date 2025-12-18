import { SearchInterface } from "@/components/search-interface"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Search Medical Records</h1>
            <p className="text-muted-foreground">Find documents instantly with real-time search</p>
          </div>
        </div>
      </header>

      <div className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <SearchInterface />
        </div>
      </div>
    </main>
  )
}
