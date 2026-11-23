import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { Voter } from "@/lib/types"
import type { VoteStore } from "@/lib/store/types"

const chains = new Map<string, Promise<unknown>>()

function lock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(file) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  chains.set(
    file,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

async function readVoters(file: string): Promise<Record<string, Voter>> {
  try {
    const text = await readFile(file, "utf8")
    const data = JSON.parse(text) as { voters?: Record<string, Voter> }
    return data.voters ?? {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw error
  }
}

async function writeVoters(file: string, voters: Record<string, Voter>): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify({ voters }, null, 2)}\n`)
  await rename(tmp, file)
}

export function createFileStore(file: string): VoteStore {
  return {
    async get(id) {
      const voters = await readVoters(file)
      return voters[id] ?? null
    },
    async update(id, updater) {
      return lock(file, async () => {
        const voters = await readVoters(file)
        const next = updater(voters[id] ?? null)
        voters[id] = next
        await writeVoters(file, voters)
        return next
      })
    },
    async list() {
      const voters = await readVoters(file)
      return Object.values(voters)
    },
  }
}

export function defaultVotesFile(): string {
  return process.env.VOTES_FILE?.trim() || path.join(process.cwd(), "data", "votes.json")
}
