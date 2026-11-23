import { Redis } from "@upstash/redis"
import { getRound } from "@/lib/designs"
import { createFileStore, defaultVotesFile } from "@/lib/store/file"
import { createRedisStore } from "@/lib/store/redis"
import { StorageNotConfiguredError, type HashClient, type VoteStore } from "@/lib/store/types"

let singleton: VoteStore | null = null
let logged = false

function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function unavailableStore(): VoteStore {
  const fail = () => {
    throw new StorageNotConfiguredError()
  }
  return { get: fail, update: fail, list: fail }
}

function redisFromEnv(): HashClient | null {
  const url = env("UPSTASH_REDIS_REST_URL") || env("KV_REST_API_URL")
  const token = env("UPSTASH_REDIS_REST_TOKEN") || env("KV_REST_API_TOKEN")
  if (!url && !token) return null
  if (!url || !token) throw new StorageNotConfiguredError()
  const redis = new Redis({ url, token })
  return {
    hset: (key, value) => redis.hset(key, value),
    hget: (key, field) => redis.hget(key, field),
    hgetall: (key) => redis.hgetall(key),
  }
}

export function getStore(): VoteStore {
  if (singleton) return singleton
  const redis = redisFromEnv()
  if (redis) {
    singleton = createRedisStore(redis, getRound().id)
    if (!logged) {
      console.info("[style-vote] using Upstash Redis")
      logged = true
    }
    return singleton
  }
  if (process.env.VERCEL) {
    singleton = unavailableStore()
    if (!logged) {
      console.error("[style-vote] Upstash Redis is not configured")
      logged = true
    }
    return singleton
  }
  const file = defaultVotesFile()
  singleton = createFileStore(file)
  if (!logged) {
    console.info(`[style-vote] using local file store at ${file}`)
    logged = true
  }
  return singleton
}

export function resetStoreForTests(): void {
  singleton = null
  logged = false
}

export { StorageNotConfiguredError } from "@/lib/store/types"
