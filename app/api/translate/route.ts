import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { content, targetLanguage } = await request.json()

    if (!content || !targetLanguage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Google Translate API key not configured. Please add GOOGLE_TRANSLATE_KEY to environment variables.",
        },
        { status: 500 },
      )
    }

    const languageMap: Record<string, string> = {
      hi: "hi", // Hindi
      te: "te", // Telugu
      kn: "kn", // Kannada
      ta: "ta", // Tamil
      bn: "bn", // Bengali
    }

    const targetLangCode = languageMap[targetLanguage] || targetLanguage

    console.log("[v0] Translating to language:", targetLangCode)

    // Extract all text values from the nested recommendation structure
    const textsToTranslate: string[] = []
    const textIndexMap: Map<string, number[]> = new Map()

    // Helper to collect texts and track their positions
    const collectTexts = (obj: any, path = "") => {
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => collectTexts(item, `${path}[${idx}]`))
      } else if (obj && typeof obj === "object") {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === "string" && value.trim()) {
            const index = textsToTranslate.length
            textsToTranslate.push(value)
            const fullPath = path ? `${path}.${key}` : key
            if (!textIndexMap.has(fullPath)) {
              textIndexMap.set(fullPath, [])
            }
            textIndexMap.get(fullPath)!.push(index)
          } else if (typeof value === "object") {
            collectTexts(value, path ? `${path}.${key}` : key)
          }
        })
      }
    }

    collectTexts(content)

    if (textsToTranslate.length === 0) {
      console.log("[v0] No text to translate")
      return NextResponse.json({ translatedRecommendations: content })
    }

    console.log(`[v0] Translating ${textsToTranslate.length} text segments...`)

    // Translate all texts in batch
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: textsToTranslate,
        target: targetLangCode,
        format: "text",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Translation API error response:", errorText)
      throw new Error(`Translation API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const translations = data.data?.translations

    if (!translations || !Array.isArray(translations)) {
      throw new Error("No translations returned from API")
    }

    // Build translated object maintaining the original structure
    const translatedTexts = translations.map((t: any) => t.translatedText)

    // Deep clone and apply translations
    const translatedContent = JSON.parse(JSON.stringify(content))

    // Helper to apply translations back
    let textIndex = 0
    const applyTranslations = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map((item) => applyTranslations(item))
      } else if (obj && typeof obj === "object") {
        const newObj: any = {}
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === "string" && value.trim()) {
            newObj[key] = translatedTexts[textIndex] || value
            textIndex++
          } else if (typeof value === "object") {
            newObj[key] = applyTranslations(value)
          } else {
            newObj[key] = value
          }
        })
        return newObj
      }
      return obj
    }

    const result = applyTranslations(translatedContent)

    console.log("[v0] Translation successful")

    return NextResponse.json({
      translatedRecommendations: result,
    })
  } catch (error: any) {
    console.error("[v0] Translation error:", error)
    return NextResponse.json({ error: "Translation failed", details: error.message }, { status: 500 })
  }
}
