import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { applyVote } from "../lib/vote"
import { createFileStore } from "../lib/store/file"
import { createMemoryStore } from "../lib/store/memory"
import { createRedisStore } from "../lib/store/redis"
import type { HashClient } from "../lib/store/types"
import type { VoteInput } from "../lib/types"

const dirs: string[] = []

after(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

function ballot(id: string, name: string, choice: string): VoteInput {
  return {
    id,
    name,
    team: "",
    picks: { "00": { choice, comment: "" } },
    overallComment: "",
    finished: false,
  }
}

function createMemoryHash(): HashClient {
  const hashes = new Map<string, Map<string, unknown>>()
  return {
    async hset(key, value) {
      const hash = hashes.get(key) ?? new Map<string, unknown>()
      for (const [field, fieldValue] of Object.entries(value)) {
        hash.set(field, JSON.parse(JSON.stringify(fieldValue)) as unknown)
      }
      hashes.set(key, hash)
      return 1
    },
    async hget(key, field) {
      const value = hashes.get(key)?.get(field)
      return (value ?? null) as never
    },
    async hgetall(key) {
      const hash = hashes.get(key)
      if (!hash || hash.size === 0) return null
      return Object.fromEntries(hash) as never
    },
  }
}

async function expectSingleVoter(save: (choice: string, name: string) => Promise<void>, list: () => Promise<{ id: string; name: string; picks: Record<string, { choice: string | null }> }[]>) {
  const id = "33333333-3333-4333-8333-333333333333"
  await save("00A", "Sam")
  await save("00C", "Sam Rivera")
  const voters = await list()
  assert.equal(voters.length, 1)
  assert.equal(voters[0]?.id, id)
  assert.equal(voters[0]?.name, "Sam Rivera")
  assert.equal(voters[0]?.picks["00"]?.choice, "00C")
}

describe("file store", () => {
  it("replaces a pick without adding a second voter", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "style-vote-"))
    dirs.push(dir)
    const store = createFileStore(path.join(dir, "votes.json"))
    const id = "33333333-3333-4333-8333-333333333333"
    await expectSingleVoter(
      async (choice, name) => {
        await store.update(id, (existing) =>
          applyVote(existing, ballot(id, name, choice), new Date().toISOString()),
        )
      },
      () => store.list(),
    )
  })

  it("keeps both voters when two writes overlap", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "style-vote-"))
    dirs.push(dir)
    const store = createFileStore(path.join(dir, "votes.json"))
    const left = "44444444-4444-4444-8444-444444444444"
    const right = "55555555-5555-4555-8555-555555555555"
    await Promise.all([
      store.update(left, (existing) => applyVote(existing, ballot(left, "Left", "00A"), "2026-11-23T00:00:00.000Z")),
      store.update(right, (existing) => applyVote(existing, ballot(right, "Right", "00B"), "2026-11-23T00:00:00.000Z")),
    ])
    const voters = await store.list()
    assert.equal(voters.length, 2)
    assert.deepEqual(
      voters.map((voter) => voter.picks["00"]?.choice).sort(),
      ["00A", "00B"],
    )
  })
})

describe("memory and redis stores", () => {
  it("memory store updates in place", async () => {
    const store = createMemoryStore()
    const id = "33333333-3333-4333-8333-333333333333"
    await expectSingleVoter(
      async (choice, name) => {
        await store.update(id, (existing) =>
          applyVote(existing, ballot(id, name, choice), new Date().toISOString()),
        )
      },
      () => store.list(),
    )
  })

  it("redis hash store updates one field", async () => {
    const store = createRedisStore(createMemoryHash(), "round-1")
    const id = "33333333-3333-4333-8333-333333333333"
    await expectSingleVoter(
      async (choice, name) => {
        await store.update(id, (existing) =>
          applyVote(existing, ballot(id, name, choice), new Date().toISOString()),
        )
      },
      () => store.list(),
    )
    assert.equal(await store.get("missing"), null)
  })
})
