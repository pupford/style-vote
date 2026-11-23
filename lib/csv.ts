import type { RoundConfig } from "@/lib/designs"
import type { Voter } from "@/lib/types"

function csvCell(value: string): string {
  let cell = value
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`
  if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
  return cell
}

export function votesToCsv(round: RoundConfig, voters: Voter[]): string {
  const headers = [
    "voter_id",
    "name",
    "team",
    "created_at",
    "updated_at",
    "finished_at",
    "overall_comment",
  ]
  for (const design of round.designs) {
    headers.push(`design_${design.id}_choice`, `design_${design.id}_comment`)
  }

  const rows = [...voters]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((voter) => {
      const cells = [
        voter.id,
        voter.name,
        voter.team,
        voter.createdAt,
        voter.updatedAt,
        voter.finishedAt ?? "",
        voter.overallComment,
      ]
      for (const design of round.designs) {
        const pick = voter.picks[design.id]
        cells.push(pick?.choice ?? "", pick?.comment ?? "")
      }
      return cells.map(csvCell).join(",")
    })

  return `\uFEFF${[headers.join(","), ...rows].join("\r\n")}\r\n`
}
