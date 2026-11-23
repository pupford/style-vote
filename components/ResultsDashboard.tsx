import { BrandHeader } from "@/components/BrandHeader"
import { TakeId } from "@/components/TakeId"
import { formatWhen, voteWord } from "@/lib/format"
import { voterLabels } from "@/lib/aggregate"
import type { ResultsPayload, TakeTally } from "@/lib/types"

function names(voters: { label: string }[]): string {
  if (voters.length === 0) return "No one yet"
  return voters.map((voter) => voter.label).join(", ")
}

function TakeRow({ take, total }: { take: TakeTally; total: number }) {
  const width = total === 0 ? 0 : Math.round((take.count / total) * 100)
  return (
    <div className="tally">
      <div className="tally-top">
        <p className="tally-name">
          <span className="letter">{take.letter}</span>
          <TakeId id={take.id} />
        </p>
        <p className="tally-count">{voteWord(take.count)}</p>
      </div>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      <p className="tally-voters">{names(take.voters)}</p>
    </div>
  )
}

export function ResultsDashboard({
  results,
  adminKey,
}: {
  results: ResultsPayload
  adminKey: string
}) {
  const { aggregates, votes, round } = results
  const labels = voterLabels(votes)
  const csvHref = `/api/results?key=${encodeURIComponent(adminKey)}&format=csv`
  const jsonHref = `/api/results?key=${encodeURIComponent(adminKey)}`
  const totalTakes = aggregates.ranking.length

  return (
    <>
      <BrandHeader title={round.title}>
        <p className="header-kicker">Results</p>
      </BrandHeader>
      <main className="wrap main" id="main" tabIndex={-1}>
        <p className="lede">
          Only people with this link can see the tally. Voters never see these numbers.
        </p>
        <div className="stats">
          <p>
            <strong>{aggregates.voterCount}</strong>
            <span>{aggregates.voterCount === 1 ? "voter" : "voters"}</span>
          </p>
          <p>
            <strong>{aggregates.finishedCount}</strong>
            <span>finished</span>
          </p>
        </div>
        <div className="actions">
          <a className="button" href={csvHref}>
            Download CSV
          </a>
          <a className="button secondary" href={jsonHref}>
            Open JSON
          </a>
        </div>
        <p className="muted small">
          Generated {formatWhen(results.generatedAt)}. JSON for scripts is{" "}
          <a href={jsonHref}>/api/results</a>.
        </p>

        {aggregates.voterCount === 0 ? (
          <p className="empty">No votes yet. Share the voting link, then refresh this page.</p>
        ) : null}

        <section className="section">
          <h2>By Design</h2>
          {aggregates.designs.map((design, index) => (
            <article className="design-block" key={design.id}>
              <p className="eyebrow">Design {index + 1} of {aggregates.designs.length}</p>
              <h3>{design.title}</h3>
              <p className="muted small">Design {design.id}</p>
              {design.takes.map((take) => (
                <TakeRow key={take.id} take={take} total={aggregates.voterCount} />
              ))}
              <div className="tally">
                <div className="tally-top">
                  <p className="tally-name">None of these feel right</p>
                  <p className="tally-count">{voteWord(design.none.count)}</p>
                </div>
                <div className="bar" aria-hidden="true">
                  <span
                    style={{
                      width:
                        aggregates.voterCount === 0
                          ? "0%"
                          : `${Math.round((design.none.count / aggregates.voterCount) * 100)}%`,
                    }}
                  />
                </div>
                <p className="tally-voters">{names(design.none.voters)}</p>
              </div>
              <p className="muted small">{design.skipped} skipped this design.</p>
              {design.comments.length > 0 ? (
                <div className="comment-list">
                  <h4>Comments</h4>
                  {design.comments.map((comment) => (
                    <blockquote key={`${comment.voterId}-${design.id}`}>
                      <p>{comment.text}</p>
                      <footer>
                        {comment.label} · {comment.choiceLabel}
                      </footer>
                    </blockquote>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>

        <section className="section">
          <h2>Overall Comments</h2>
          {aggregates.overallComments.length === 0 ? (
            <p className="muted">No overall comments yet.</p>
          ) : (
            <div className="comment-list">
              {aggregates.overallComments.map((comment) => (
                <blockquote key={comment.voterId}>
                  <p>{comment.text}</p>
                  <footer>{comment.label}</footer>
                </blockquote>
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <h2>Ranking</h2>
          <p className="muted">
            All {totalTakes} takes, by votes. Ties share a rank and then follow design order.
          </p>
          <ol className="ranking">
            {aggregates.ranking.map((row) => (
              <li key={row.takeId}>
                <span className="rank">{row.rank}</span>
                <span className="rank-votes">{row.votes}</span>
                <span className="rank-id">
                  <TakeId id={row.takeId} />
                </span>
                <span className="rank-title">{row.designTitle}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="section">
          <h2>Voters</h2>
          <ul className="voter-list">
            {votes.map((voter) => {
              const picks = Object.values(voter.picks).filter((pick) => pick.choice).length
              return (
                <li key={voter.id}>
                  <strong>{labels.get(voter.id) ?? voter.name}</strong>
                  <span>{voter.finishedAt ? "Finished" : "In progress"}</span>
                  <span>
                    {picks} of {aggregates.designs.length} picks
                  </span>
                  <span className="muted">{formatWhen(voter.updatedAt)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
    </>
  )
}

export function OwnerGate() {
  return (
    <>
      <BrandHeader title="Pupford Illustration Style Vote, Round 1" />
      <main className="wrap main narrow" id="main" tabIndex={-1}>
        <h2>This page is for the brand owner</h2>
        <p>Open it with the admin key on the end of the URL.</p>
      </main>
    </>
  )
}

export function StorageMessage() {
  return (
    <>
      <BrandHeader title="Pupford Illustration Style Vote, Round 1" />
      <main className="wrap main narrow" id="main" tabIndex={-1}>
        <h2>Vote storage is not ready</h2>
        <p>
          Add Upstash Redis from the Vercel Marketplace, connect it to this project, and redeploy.
          Locally, votes are stored in data/votes.json and this message should not appear.
        </p>
      </main>
    </>
  )
}
