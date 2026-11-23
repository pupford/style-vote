export type DesignPick = {
  choice: string | null
  comment: string
  updatedAt: string
}

export type Voter = {
  id: string
  name: string
  team: string
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  overallComment: string
  picks: Record<string, DesignPick>
}

export type VoteInput = {
  id: string
  name: string
  team: string
  picks: Record<string, { choice: string | null; comment: string }>
  overallComment: string
  finished: boolean
}

export type VoterRef = {
  id: string
  label: string
}

export type TakeTally = {
  id: string
  letter: string
  count: number
  voters: VoterRef[]
}

export type CommentRow = {
  voterId: string
  name: string
  label: string
  choice: string | null
  choiceLabel: string
  text: string
}

export type DesignTally = {
  id: string
  title: string
  takes: TakeTally[]
  none: { count: number; voters: VoterRef[] }
  skipped: number
  comments: CommentRow[]
}

export type RankRow = {
  rank: number
  takeId: string
  letter: string
  designId: string
  designTitle: string
  votes: number
}

export type Aggregates = {
  voterCount: number
  finishedCount: number
  designs: DesignTally[]
  ranking: RankRow[]
  overallComments: CommentRow[]
}

export type ResultsPayload = {
  round: { id: string; name: string; title: string }
  generatedAt: string
  aggregates: Aggregates
  votes: Voter[]
}
