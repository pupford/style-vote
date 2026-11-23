import type { Voter } from "@/lib/types"
import type { HashClient, VoteStore } from "@/lib/store/types"

export function votersKey(roundId: string): string {
  return `pupford:style-vote:${roundId}:voters`
}

function decodeVoter(value: unknown): Voter | null {
  let current = value
  if (typeof current === "string") {
    try {
      current = JSON.parse(current) as unknown
    } catch {
      return null
    }
  }
  if (!current || typeof current !== "object") return null
  const voter = current as Voter
  if (typeof voter.id !== "string" || typeof voter.name !== "string" || !voter.picks) return null
  return voter
}

export function createRedisStore(client: HashClient, roundId: string): VoteStore {
  const key = votersKey(roundId)
  return {
    async get(id) {
      const value = await client.hget<unknown>(key, id)
      return decodeVoter(value)
    },
    async update(id, updater) {
      const existing = decodeVoter(await client.hget<unknown>(key, id))
      const next = updater(existing)
      await client.hset(key, { [id]: next })
      return next
    },
    async list() {
      const all = await client.hgetall<Record<string, unknown>>(key)
      if (!all) return []
      return Object.values(all)
        .map((value) => decodeVoter(value))
        .filter((voter): voter is Voter => voter !== null)
    },
  }
}
