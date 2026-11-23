import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { aggregate, buildResults } from "../lib/aggregate"
import { votesToCsv } from "../lib/csv"
import { getRound } from "../lib/designs"
import { applyVote, parseVoteRequest } from "../lib/vote"
import type { VoteInput, Voter } from "../lib/types"

const round = getRound()

function input(overrides: Partial<VoteInput> = {}): VoteInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Sam",
    team: "Design",
    picks: {},
    overallComment: "",
    finished: false,
    ...overrides,
  }
}

describe("round config", () => {
  it("keeps design 00 first and lists 33 unique takes", () => {
    assert.equal(round.title, "Pupford Illustration Style Vote, Round 1")
    assert.equal(
      round.intro,
      "Help us find the illustration style that feels most like Pupford. For each design, pick the take that's closest to our brand, and tell us why if you like.",
    )
    assert.equal(round.designs.length, 11)
    assert.equal(round.designs[0]?.id, "00")
    assert.equal(round.designs[0]?.title, "Girl with glasses + Bernese mountain dog")
    const takes = round.designs.flatMap((design) => design.takes)
    assert.equal(takes.length, 33)
    assert.equal(new Set(takes).size, 33)
    assert.deepEqual(round.designs[0]?.takes, ["00A", "00B", "00C"])
  })
})

describe("parseVoteRequest", () => {
  it("trims the name and accepts a real take or none", () => {
    const parsed = parseVoteRequest({
      id: "11111111-1111-4111-8111-111111111111",
      name: "  Sam   Rivera ",
      team: "  Design  ",
      picks: {
        "00": { choice: "00A", comment: "  Warm and simple.  " },
        "01": { choice: "none", comment: "" },
      },
      finished: false,
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.value.name, "Sam Rivera")
    assert.equal(parsed.value.team, "Design")
    assert.equal(parsed.value.picks["00"]?.comment, "Warm and simple.")
    assert.equal(parsed.value.picks["01"]?.choice, "none")
  })

  it("rejects a take from a different design", () => {
    const parsed = parseVoteRequest({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Sam",
      picks: { "01": { choice: "00A", comment: "" } },
    })
    assert.equal(parsed.ok, false)
  })

  it("rejects a missing name and a bad id", () => {
    assert.equal(parseVoteRequest({ id: "nope", name: "Sam" }).ok, false)
    assert.equal(
      parseVoteRequest({ id: "11111111-1111-4111-8111-111111111111", name: "   " }).ok,
      false,
    )
  })
})

describe("applyVote", () => {
  it("updates one pick in place and keeps the others", () => {
    const now = "2026-11-23T00:00:00.000Z"
    const created = applyVote(
      null,
      input({
        picks: {
          "00": { choice: "00A", comment: "First" },
          "01": { choice: "01B", comment: "" },
        },
      }),
      now,
    )
    const changed = applyVote(
      created,
      input({
        picks: { "00": { choice: "00C", comment: "First" } },
        finished: true,
      }),
      "2026-11-23T01:00:00.000Z",
    )
    assert.equal(changed.createdAt, now)
    assert.equal(changed.picks["00"]?.choice, "00C")
    assert.equal(changed.picks["00"]?.updatedAt, "2026-11-23T01:00:00.000Z")
    assert.equal(changed.picks["01"]?.choice, "01B")
    assert.equal(changed.finishedAt, "2026-11-23T01:00:00.000Z")

    const again = applyVote(
      changed,
      input({ picks: { "00": { choice: "00C", comment: "First" } }, finished: false }),
      "2026-11-23T02:00:00.000Z",
    )
    assert.equal(again.finishedAt, "2026-11-23T01:00:00.000Z")
    assert.equal(again.picks["00"]?.updatedAt, "2026-11-23T01:00:00.000Z")
  })
})

describe("aggregate", () => {
  it("counts voters once, ranks every take, and keeps none out of the ranking", () => {
    const sam = applyVote(
      null,
      input({
        name: "Sam",
        team: "Design",
        picks: {
          "00": { choice: "00A", comment: "This one feels like us." },
          "01": { choice: "none", comment: "Too stiff." },
        },
        overallComment: "Keep the grain.",
        finished: true,
      }),
      "2026-11-23T00:00:00.000Z",
    )
    const jo = applyVote(
      null,
      input({
        id: "22222222-2222-4222-8222-222222222222",
        name: "Jo",
        team: "",
        picks: { "00": { choice: "00A", comment: "" } },
        finished: false,
      }),
      "2026-11-23T00:00:00.000Z",
    )
    const results = buildResults(round, [jo, sam], "2026-11-23T03:00:00.000Z")
    assert.equal(results.aggregates.voterCount, 2)
    assert.equal(results.aggregates.finishedCount, 1)
    assert.equal(results.votes[0]?.name, "Jo")
    const design00 = results.aggregates.designs[0]
    assert.equal(design00?.takes.find((take) => take.id === "00A")?.count, 2)
    assert.deepEqual(
      design00?.takes.find((take) => take.id === "00A")?.voters.map((voter) => voter.label),
      ["Jo", "Sam · Design"],
    )
    assert.equal(results.aggregates.designs[1]?.none.count, 1)
    assert.equal(results.aggregates.designs[1]?.comments[0]?.text, "Too stiff.")
    assert.equal(results.aggregates.overallComments[0]?.text, "Keep the grain.")
    assert.equal(results.aggregates.ranking.length, 33)
    assert.equal(results.aggregates.ranking[0]?.takeId, "00A")
    assert.equal(results.aggregates.ranking[0]?.votes, 2)
    assert.equal(results.aggregates.ranking.filter((row) => row.votes === 0).length, 32)
    assert.equal(
      results.aggregates.ranking.some((row) => row.takeId === "none"),
      false,
    )
    assert.equal(aggregate(round, []).voterCount, 0)
    assert.equal(aggregate(round, []).ranking.length, 33)
  })
})

describe("csv", () => {
  it("quotes commas and neutralizes spreadsheet formulas", () => {
    const voter: Voter = applyVote(
      null,
      input({
        name: '=cmd|" /S"',
        team: "Design, brand",
        picks: { "00": { choice: "00B", comment: 'She said "yes"' } },
        overallComment: "Line one\nLine two",
      }),
      "2026-11-23T00:00:00.000Z",
    )
    const csv = votesToCsv(round, [voter])
    assert.match(csv, /^\uFEFF/)
    assert.match(csv, /design_00_choice/)
    assert.match(csv, /"'=cmd/)
    assert.match(csv, /"Design, brand"/)
    assert.match(csv, /00B/)
    assert.match(csv, /"She said ""yes"""/)
  })
})
