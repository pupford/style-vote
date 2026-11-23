import { NextResponse } from "next/server"
import { checkAdminKey } from "@/lib/admin"
import { buildResults } from "@/lib/aggregate"
import { votesToCsv } from "@/lib/csv"
import { getRound } from "@/lib/designs"
import { getStore, StorageNotConfiguredError } from "@/lib/store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (!checkAdminKey(url.searchParams.get("key"))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const round = getRound()
    const voters = await getStore().list()
    const format = url.searchParams.get("format")?.toLowerCase()
    if (format === "csv") {
      return new NextResponse(votesToCsv(round, voters), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pupford-style-vote-${round.id}.csv"`,
          "Cache-Control": "no-store",
        },
      })
    }
    return NextResponse.json(buildResults(round, voters), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }
    console.error("results read failed")
    return NextResponse.json(
      { error: "Could not load results." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
