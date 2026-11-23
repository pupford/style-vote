import { NextResponse } from "next/server"
import { MAX_BODY_BYTES, MAX_VOTERS } from "@/lib/constants"
import { getStore, StorageNotConfiguredError } from "@/lib/store"
import { applyVote, parseVoteRequest } from "@/lib/vote"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const noStore = { "Cache-Control": "no-store" }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  if (!id) return json({ error: "Missing ballot id." }, 400)
  try {
    const voter = await getStore().get(id.toLowerCase())
    if (!voter) return json({ error: "Not found." }, 404)
    return json(voter)
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return json({ error: error.message }, 503)
    console.error("vote read failed")
    return json({ error: "Could not load the vote." }, 500)
  }
}

export async function POST(request: Request) {
  let text: string
  try {
    text = await request.text()
  } catch {
    return json({ error: "Send a JSON body." }, 400)
  }
  if (text.length > MAX_BODY_BYTES) return json({ error: "That vote is too large." }, 413)

  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    return json({ error: "Send a JSON body." }, 400)
  }

  const parsed = parseVoteRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)

  try {
    const store = getStore()
    const existing = await store.get(parsed.value.id)
    if (!existing) {
      const voters = await store.list()
      if (voters.length >= MAX_VOTERS) return json({ error: "This round is full." }, 400)
    }
    const voter = await store.update(parsed.value.id, (current) =>
      applyVote(current, parsed.value, new Date().toISOString()),
    )
    return json(voter)
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return json({ error: error.message }, 503)
    console.error("vote save failed")
    return json({ error: "Could not save the vote." }, 500)
  }
}
