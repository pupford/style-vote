import { choiceLabel, takeLetter, type RoundConfig } from "@/lib/designs"
import { NONE } from "@/lib/constants"
import type {
  Aggregates,
  CommentRow,
  RankRow,
  ResultsPayload,
  Voter,
  VoterRef,
} from "@/lib/types"

export function voterLabels(voters: Voter[]): Map<string, string> {
  const bases = voters.map((voter) => ({
    id: voter.id,
    base: voter.team ? `${voter.name} · ${voter.team}` : voter.name,
  }))
  const counts = new Map<string, number>()
  for (const item of bases) counts.set(item.base, (counts.get(item.base) ?? 0) + 1)
  const labels = new Map<string, string>()
  for (const item of bases) {
    const duplicate = (counts.get(item.base) ?? 0) > 1
    labels.set(item.id, duplicate ? `${item.base} (${item.id.slice(0, 4)})` : item.base)
  }
  return labels
}

function byLabel(a: VoterRef, b: VoterRef): number {
  return a.label.localeCompare(b.label) || a.id.localeCompare(b.id)
}

export function aggregate(round: RoundConfig, voters: Voter[]): Aggregates {
  const labels = voterLabels(voters)
  const labelFor = (voter: Voter) => labels.get(voter.id) ?? voter.name

  const designs = round.designs.map((design) => {
    const buckets = new Map<string, VoterRef[]>()
    for (const take of design.takes) buckets.set(take, [])
    const none: VoterRef[] = []
    let skipped = 0
    const comments: CommentRow[] = []

    for (const voter of voters) {
      const pick = voter.picks[design.id]
      const choice = pick?.choice ?? null
      const ref = { id: voter.id, label: labelFor(voter) }
      if (choice && design.takes.includes(choice)) {
        buckets.get(choice)?.push(ref)
      } else if (choice === NONE) {
        none.push(ref)
      } else {
        skipped += 1
      }
      const text = pick?.comment?.trim() ?? ""
      if (text) {
        comments.push({
          voterId: voter.id,
          name: voter.name,
          label: ref.label,
          choice,
          choiceLabel: choiceLabel(choice && (design.takes.includes(choice) || choice === NONE) ? choice : null),
          text,
        })
      }
    }

    for (const list of buckets.values()) list.sort(byLabel)
    none.sort(byLabel)
    comments.sort((a, b) => a.label.localeCompare(b.label) || a.voterId.localeCompare(b.voterId))

    return {
      id: design.id,
      title: design.title,
      takes: design.takes.map((take) => {
        const votersForTake = buckets.get(take) ?? []
        return {
          id: take,
          letter: takeLetter(take),
          count: votersForTake.length,
          voters: votersForTake,
        }
      }),
      none: { count: none.length, voters: none },
      skipped,
      comments,
    }
  })

  const ranked: Omit<RankRow, "rank">[] = []
  round.designs.forEach((design, designIndex) => {
    design.takes.forEach((take, takeIndex) => {
      const tally = designs[designIndex]?.takes[takeIndex]
      ranked.push({
        takeId: take,
        letter: takeLetter(take),
        designId: design.id,
        designTitle: design.title,
        votes: tally?.count ?? 0,
      })
    })
  })
  ranked.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes
    if (a.designId !== b.designId) return a.designId.localeCompare(b.designId)
    return a.letter.localeCompare(b.letter)
  })

  let rank = 1
  const ranking: RankRow[] = ranked.map((row, index) => {
    if (index > 0 && row.votes < ranked[index - 1].votes) rank = index + 1
    return { rank, ...row }
  })

  const overallComments: CommentRow[] = voters
    .filter((voter) => voter.overallComment.trim())
    .map((voter) => ({
      voterId: voter.id,
      name: voter.name,
      label: labelFor(voter),
      choice: null,
      choiceLabel: "Overall",
      text: voter.overallComment.trim(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.voterId.localeCompare(b.voterId))

  return {
    voterCount: voters.length,
    finishedCount: voters.filter((voter) => voter.finishedAt).length,
    designs,
    ranking,
    overallComments,
  }
}

export function buildResults(round: RoundConfig, voters: Voter[], now = new Date().toISOString()): ResultsPayload {
  const votes = [...voters].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  )
  return {
    round: { id: round.id, name: round.round, title: round.title },
    generatedAt: now,
    aggregates: aggregate(round, votes),
    votes,
  }
}
