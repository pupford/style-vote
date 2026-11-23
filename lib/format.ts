export function formatWhen(iso: string | null): string {
  if (!iso) return "Not finished"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date)
}

export function voteWord(count: number): string {
  return count === 1 ? "1 vote" : `${count} votes`
}
