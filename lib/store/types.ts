import type { Voter } from "@/lib/types"

export type VoteUpdater = (existing: Voter | null) => Voter

export type VoteStore = {
  get(id: string): Promise<Voter | null>
  update(id: string, updater: VoteUpdater): Promise<Voter>
  list(): Promise<Voter[]>
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Vote storage is not configured.")
    this.name = "StorageNotConfiguredError"
  }
}

export type HashClient = {
  hset(key: string, value: Record<string, unknown>): Promise<unknown>
  hget<T>(key: string, field: string): Promise<T | null>
  hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null>
}
