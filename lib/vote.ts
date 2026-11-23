import { getRound, type RoundConfig } from "@/lib/designs"
import { LIMITS, NONE } from "@/lib/constants"
import type { VoteInput, Voter } from "@/lib/types"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseVoteRequest(
  body: unknown,
  round: RoundConfig = getRound(),
): { ok: true; value: VoteInput } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "Send a vote object." }
  if (typeof body.id !== "string" || !UUID.test(body.id)) {
    return { ok: false, error: "That ballot id is not valid." }
  }
  if (typeof body.name !== "string") return { ok: false, error: "Add your name." }
  const name = body.name.replace(/\s+/g, " ").trim()
  if (!name) return { ok: false, error: "Add your name." }
  if (name.length > LIMITS.name) return { ok: false, error: "That name is too long." }

  let team = ""
  if (body.team !== undefined && body.team !== null && body.team !== "") {
    if (typeof body.team !== "string") return { ok: false, error: "Team should be text." }
    team = body.team.replace(/\s+/g, " ").trim()
    if (team.length > LIMITS.team) return { ok: false, error: "That team name is too long." }
  }

  if (
    body.overallComment !== undefined &&
    body.overallComment !== null &&
    typeof body.overallComment !== "string"
  ) {
    return { ok: false, error: "The overall comment should be text." }
  }
  const overallComment = typeof body.overallComment === "string" ? body.overallComment.trim() : ""
  if (overallComment.length > LIMITS.overall) {
    return { ok: false, error: "That overall comment is too long." }
  }

  if (body.finished !== undefined && typeof body.finished !== "boolean") {
    return { ok: false, error: "Finished should be true or false." }
  }

  const picks: VoteInput["picks"] = {}
  if (body.picks !== undefined) {
    if (!isRecord(body.picks)) return { ok: false, error: "Picks should be an object." }
    for (const [designId, raw] of Object.entries(body.picks)) {
      const design = round.designs.find((item) => item.id === designId)
      if (!design) return { ok: false, error: "Unknown design." }
      if (!isRecord(raw)) return { ok: false, error: "A pick is missing its details." }
      let choice: string | null = null
      if (raw.choice !== undefined && raw.choice !== null && raw.choice !== "") {
        if (typeof raw.choice !== "string") return { ok: false, error: "A pick has a bad choice." }
        if (raw.choice !== NONE && !design.takes.includes(raw.choice)) {
          return { ok: false, error: "That take is not part of this design." }
        }
        choice = raw.choice
      }
      if (raw.comment !== undefined && raw.comment !== null && typeof raw.comment !== "string") {
        return { ok: false, error: "A comment should be text." }
      }
      const comment = typeof raw.comment === "string" ? raw.comment.trim() : ""
      if (comment.length > LIMITS.comment) return { ok: false, error: "That comment is too long." }
      if (choice === null && comment === "") continue
      picks[designId] = { choice, comment }
    }
  }

  return {
    ok: true,
    value: {
      id: body.id.toLowerCase(),
      name,
      team,
      picks,
      overallComment,
      finished: body.finished === true,
    },
  }
}

export function applyVote(existing: Voter | null, input: VoteInput, now: string): Voter {
  const picks: Voter["picks"] = { ...(existing?.picks ?? {}) }
  for (const [designId, pick] of Object.entries(input.picks)) {
    const prev = picks[designId]
    const changed = !prev || prev.choice !== pick.choice || prev.comment !== pick.comment
    picks[designId] = {
      choice: pick.choice,
      comment: pick.comment,
      updatedAt: changed ? now : prev.updatedAt,
    }
  }
  return {
    id: input.id,
    name: input.name,
    team: input.team,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    finishedAt: input.finished ? (existing?.finishedAt ?? now) : (existing?.finishedAt ?? null),
    overallComment: input.overallComment,
    picks,
  }
}
