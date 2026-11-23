import type { Metadata } from "next"
import { checkAdminKey } from "@/lib/admin"
import { buildResults } from "@/lib/aggregate"
import { OwnerGate, ResultsDashboard, StorageMessage } from "@/components/ResultsDashboard"
import { getRound } from "@/lib/designs"
import { getStore, StorageNotConfiguredError } from "@/lib/store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const metadata: Metadata = {
  title: "Results · Pupford Illustration Style Vote, Round 1",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const { key } = await searchParams
  if (!checkAdminKey(key ?? null)) return <OwnerGate />

  try {
    const round = getRound()
    const voters = await getStore().list()
    const results = buildResults(round, voters)
    return <ResultsDashboard results={results} adminKey={key ?? ""} />
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return <StorageMessage />
    throw error
  }
}
