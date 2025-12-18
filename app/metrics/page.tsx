"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  FileText,
  Activity,
  ArrowLeft,
  Building2,
  Pill,
  Stethoscope,
  TrendingUp,
  Clock,
  CheckCircle2,
  Zap,
  Database,
} from "lucide-react"
import Link from "next/link"

interface MetricsData {
  totalRecords: number
  recordsWithData: number
  documentTypes: Record<string, number>
  topHospitals: Array<{ name: string; count: number }>
  topDiagnoses: Array<{ name: string; count: number }>
  topMedications: Array<{ name: string; count: number }>
  topProcedures: Array<{ name: string; count: number }>
  genderDistribution: {
    Male: number
    Female: number
    Other: number
    Unknown: number
  }
  ageDistribution: {
    "0-17": number
    "18-30": number
    "31-45": number
    "46-60": number
    "61+": number
    Unknown: number
  }
  processingTrends: {
    last7Days: number
    last30Days: number
    last90Days: number
  }
  averageFieldsExtracted: number
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/metrics")

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 404 || errorData.error?.includes("table") || errorData.error?.includes("column")) {
          setError("database_not_setup")
        } else {
          setError("fetch_failed")
        }
        return
      }
      const data = await response.json()
      setMetrics(data)
    } catch (error) {
      console.error("[v0] Metrics fetch error:", error)
      setError("fetch_failed")
    } finally {
      setIsLoading(false)
    }
  }

  const getPercentage = (count: number, total?: number) => {
    const denominator = total || metrics?.totalRecords || 0
    if (denominator === 0) return "0"
    return ((count / denominator) * 100).toFixed(1)
  }

  const getDataCompleteness = () => {
    if (!metrics || metrics.totalRecords === 0) return "0"
    return ((metrics.recordsWithData / metrics.totalRecords) * 100).toFixed(1)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="border border-border/50 shadow-sm">
          <div className="p-8 text-center space-y-4">
            <Activity className="w-12 h-12 text-primary mx-auto animate-pulse" />
            <p className="text-foreground">Loading TPA metrics...</p>
          </div>
        </Card>
      </div>
    )
  }

  if (error === "database_not_setup") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          <Link href="/">
            <Button variant="outline" className="mb-8 gap-2 bg-transparent">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>

          <Card className="border border-border/50 shadow-sm">
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
                  <Activity className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Database Setup Required</h1>
                <p className="text-muted-foreground text-lg">
                  The database schema needs to be updated. Please run the migration script.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-lg bg-muted/50 border border-border/50">
                  <h3 className="font-semibold text-foreground mb-2">Run the dynamic schema migration</h3>
                  <code className="text-xs bg-background p-3 block rounded border border-border font-mono">
                    scripts/006_simplify_to_dynamic_schema.sql
                  </code>
                </div>

                <Button onClick={() => window.location.reload()} className="w-full mt-6 shadow-sm">
                  Refresh Page After Running Script
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!metrics || error === "fetch_failed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="border border-border/50 shadow-sm">
          <div className="p-8 text-center space-y-4">
            <p className="text-foreground">Failed to load metrics. Please try again.</p>
            <Button onClick={fetchMetrics}>Retry</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (metrics.totalRecords === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          <Link href="/">
            <Button variant="outline" className="mb-8 gap-2 bg-transparent">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>

          <Card className="border border-border/50 shadow-sm">
            <div className="p-8 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-muted mb-4">
                <BarChart3 className="w-12 h-12 text-muted-foreground" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">No Data Available</h1>
              <p className="text-muted-foreground text-lg mb-6">Upload documents to see TPA analytics.</p>
              <Link href="/">
                <Button>Upload Documents</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        <Link href="/">
          <Button variant="outline" className="mb-8 gap-2 bg-transparent">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">TPA Analytics Dashboard</h1>
          <p className="text-muted-foreground text-lg">Comprehensive document parsing and clinical data insights</p>
        </div>

        <Tabs defaultValue="parsing" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="parsing" className="gap-2">
              <Zap className="w-4 h-4" />
              Document Parsing
            </TabsTrigger>
            <TabsTrigger value="clinical" className="gap-2">
              <Database className="w-4 h-4" />
              Clinical Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parsing" className="space-y-8">
            {/* Key Parsing Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">Total Documents</h3>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{metrics.totalRecords}</p>
                  <p className="text-sm text-muted-foreground mt-1">Processed records</p>
                </div>
              </Card>

              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-foreground">Success Rate</h3>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{getDataCompleteness()}%</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {metrics.recordsWithData} of {metrics.totalRecords} parsed
                  </p>
                </div>
              </Card>

              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-foreground">Avg Fields Extracted</h3>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{Math.round(metrics.averageFieldsExtracted)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Per document</p>
                </div>
              </Card>

              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-foreground">Last 30 Days</h3>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{metrics.processingTrends.last30Days}</p>
                  <p className="text-sm text-muted-foreground mt-1">Documents processed</p>
                </div>
              </Card>
            </div>

            {/* Processing Trends */}
            <Card className="border border-border/50 shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="w-5 h-5 text-foreground" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Processing Volume Trends</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Last 7 Days</p>
                    <p className="text-2xl font-bold text-foreground">{metrics.processingTrends.last7Days}</p>
                    <p className="text-xs text-muted-foreground mt-1">documents</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Last 30 Days</p>
                    <p className="text-2xl font-bold text-foreground">{metrics.processingTrends.last30Days}</p>
                    <p className="text-xs text-muted-foreground mt-1">documents</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Last 90 Days</p>
                    <p className="text-2xl font-bold text-foreground">{metrics.processingTrends.last90Days}</p>
                    <p className="text-xs text-muted-foreground mt-1">documents</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Document Types Distribution */}
            <Card className="border border-border/50 shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="w-5 h-5 text-foreground" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Document Type Distribution</h2>
                </div>
                <div className="space-y-3">
                  {Object.entries(metrics.documentTypes || {}).length > 0 ? (
                    Object.entries(metrics.documentTypes).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-foreground font-medium">{type}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${getPercentage(count)}%` }} />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">{getPercentage(count)}%</span>
                          <span className="text-foreground font-semibold w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No document type data available</p>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="clinical" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Hospitals/Providers */}
              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-muted">
                      <Building2 className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Top Providers</h2>
                  </div>
                  <div className="space-y-3">
                    {metrics.topHospitals && metrics.topHospitals.length > 0 ? (
                      metrics.topHospitals.slice(0, 5).map((hospital, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-foreground font-medium">{hospital.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{getPercentage(hospital.count)}%</span>
                            <span className="text-foreground font-semibold">{hospital.count}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No provider data available</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Top Diagnoses */}
              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-muted">
                      <Stethoscope className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Top Diagnoses</h2>
                  </div>
                  <div className="space-y-3">
                    {metrics.topDiagnoses && metrics.topDiagnoses.length > 0 ? (
                      metrics.topDiagnoses.slice(0, 5).map((diagnosis, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-foreground font-medium text-sm">{diagnosis.name}</span>
                          <span className="text-foreground font-semibold">{diagnosis.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No diagnosis data available</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Top Medications */}
              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-muted">
                      <Pill className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Top Medications</h2>
                  </div>
                  <div className="space-y-3">
                    {metrics.topMedications && metrics.topMedications.length > 0 ? (
                      metrics.topMedications.slice(0, 5).map((medication, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-foreground font-medium text-sm">{medication.name}</span>
                          <span className="text-foreground font-semibold">{medication.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No medication data available</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Top Procedures */}
              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-muted">
                      <Activity className="w-5 h-5 text-foreground" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Top Procedures</h2>
                  </div>
                  <div className="space-y-3">
                    {metrics.topProcedures && metrics.topProcedures.length > 0 ? (
                      metrics.topProcedures.slice(0, 5).map((procedure, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-foreground font-medium text-sm">{procedure.name}</span>
                          <span className="text-foreground font-semibold">{procedure.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No procedure data available</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Demographics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Gender Distribution */}
              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Gender Distribution</h2>
                  <div className="space-y-3">
                    {metrics.genderDistribution &&
                      Object.entries(metrics.genderDistribution).map(([gender, count]) => (
                        <div key={gender} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-foreground font-medium">{gender}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{getPercentage(count)}%</span>
                            <span className="text-foreground font-semibold">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </Card>

              {/* Age Distribution */}
              <Card className="border border-border/50 shadow-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Age Distribution</h2>
                  <div className="space-y-3">
                    {metrics.ageDistribution &&
                      Object.entries(metrics.ageDistribution).map(([range, count]) => (
                        <div key={range} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-foreground font-medium">{range}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{getPercentage(count)}%</span>
                            <span className="text-foreground font-semibold">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
