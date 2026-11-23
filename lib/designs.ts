import round from "@/config/designs.json"
import { NONE } from "@/lib/constants"

export type Design = {
  id: string
  title: string
  takes: string[]
}

export type RoundConfig = {
  id: string
  round: string
  title: string
  intro: string
  designs: Design[]
}

export function getRound(): RoundConfig {
  const config = round as RoundConfig
  if (!config.id || !Array.isArray(config.designs) || config.designs.length === 0) {
    throw new Error("config/designs.json is missing a round id or designs.")
  }
  return config
}

export function takeLetter(takeId: string): string {
  return takeId.slice(-1).toUpperCase()
}

export function choiceLabel(choice: string | null): string {
  if (!choice) return "No pick"
  if (choice === NONE) return "None of these"
  return `Take ${takeLetter(choice)}`
}

export { NONE }
