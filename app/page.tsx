import { VoteApp } from "@/components/VoteApp"
import { getRound } from "@/lib/designs"

export const dynamic = "force-static"

export default function HomePage() {
  return <VoteApp round={getRound()} />
}
