import { ResultsView } from "@/components/results-view"

export default function ResultsPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Parsed Medical Record</h1>
            <p className="text-muted-foreground">AI-extracted structured data</p>
          </div>
        </div>
      </header>

      <div className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <ResultsView document={null} />
        </div>
      </div>
    </main>
  )
}
