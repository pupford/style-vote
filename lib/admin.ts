import { timingSafeEqual } from "node:crypto"

export function checkAdminKey(provided: string | null | undefined): boolean {
  const expected = process.env.ADMIN_KEY ?? ""
  if (!expected || !provided) return false
  const actual = Buffer.from(provided)
  const wanted = Buffer.from(expected)
  if (actual.length !== wanted.length) {
    timingSafeEqual(wanted, wanted)
    return false
  }
  return timingSafeEqual(actual, wanted)
}
