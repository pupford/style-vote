import type { Voter } from "@/lib/types"
import type { VoteStore } from "@/lib/store/types"

export function createMemoryStore(initial: Voter[] = []): VoteStore {
  const voters = new Map<string, Voter>(initial.map((voter) => [voter.id, voter]))
  return {
    async get(id) {
      return voters.get(id) ?? null
    },
    async update(id, updater) {
      const next = updater(voters.get(id) ?? null)
      voters.set(id, next)
      return next
    },
    async list() {
      return [...voters.values()]
    },
  }
}
