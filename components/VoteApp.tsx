"use client"

import Image from "next/image"
import { FormEvent, useEffect, useRef, useState } from "react"
import { BrandHeader } from "@/components/BrandHeader"
import { TakeId } from "@/components/TakeId"
import { LIMITS, NONE } from "@/lib/constants"
import { takeLetter, type RoundConfig } from "@/lib/designs"
import type { Voter } from "@/lib/types"

type PickMap = Record<string, { choice: string | null; comment: string }>
type Screen = "loading" | "identify" | "design" | "wrapup" | "done"
type SaveState = "idle" | "saving" | "saved" | "error"

type Ballot = {
  id: string
  name: string
  team: string
  picks: PickMap
  overallComment: string
  finished: boolean
  revision: number
  savedRevision: number
}

function storageKey(roundId: string) {
  return `pupford-style-vote:${roundId}`
}

function emptyBallot(): Ballot {
  return {
    id: "",
    name: "",
    team: "",
    picks: {},
    overallComment: "",
    finished: false,
    revision: 0,
    savedRevision: 0,
  }
}

function sanitizePicks(round: RoundConfig, picks: PickMap | undefined): PickMap {
  const clean: PickMap = {}
  if (!picks) return clean
  for (const design of round.designs) {
    const pick = picks[design.id]
    if (!pick) continue
    const rawChoice = typeof pick.choice === "string" ? pick.choice : null
    const choice =
      rawChoice === NONE || (rawChoice !== null && design.takes.includes(rawChoice)) ? rawChoice : null
    const comment = typeof pick.comment === "string" ? pick.comment : ""
    if (!choice && !comment.trim()) continue
    clean[design.id] = { choice, comment }
  }
  return clean
}

function readBallot(round: RoundConfig): Ballot | null {
  try {
    const raw = localStorage.getItem(storageKey(round.id))
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<Ballot>
    if (!data || typeof data.id !== "string" || typeof data.name !== "string") return null
    return {
      ...emptyBallot(),
      id: data.id,
      name: data.name,
      team: typeof data.team === "string" ? data.team : "",
      picks: sanitizePicks(round, data.picks),
      overallComment: typeof data.overallComment === "string" ? data.overallComment : "",
      finished: Boolean(data.finished),
      revision: typeof data.revision === "number" ? data.revision : 0,
      savedRevision: typeof data.savedRevision === "number" ? data.savedRevision : 0,
    }
  } catch {
    return null
  }
}

function writeBallot(roundId: string, ballot: Ballot) {
  try {
    localStorage.setItem(storageKey(roundId), JSON.stringify(ballot))
  } catch {
    // Private mode can reject storage. The server copy is the other copy.
  }
}

function fromServer(round: RoundConfig, voter: Voter, revision: number): Ballot {
  const picks: PickMap = {}
  for (const [id, pick] of Object.entries(voter.picks ?? {})) {
    picks[id] = { choice: pick.choice, comment: pick.comment }
  }
  return {
    id: voter.id,
    name: voter.name,
    team: voter.team ?? "",
    picks: sanitizePicks(round, picks),
    overallComment: voter.overallComment ?? "",
    finished: Boolean(voter.finishedAt),
    revision,
    savedRevision: revision,
  }
}

function choiceText(choice: string | null | undefined): string {
  if (!choice) return "Skipped"
  if (choice === NONE) return "None of these feel right"
  return `${takeLetter(choice)} · ${choice}`
}

export function VoteApp({ round }: { round: RoundConfig }) {
  const [ballot, setBallot] = useState<Ballot>(emptyBallot)
  const ballotRef = useRef(ballot)
  ballotRef.current = ballot
  const [screen, setScreen] = useState<Screen>("loading")
  const [index, setIndex] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [formError, setFormError] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [teamInput, setTeamInput] = useState("")
  const [editingName, setEditingName] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [welcome, setWelcome] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true))
  const timer = useRef<number | null>(null)
  const returnTo = useRef<{ screen: Screen; index: number }>({ screen: "identify", index: 0 })
  const dialogRef = useRef<HTMLDialogElement>(null)
  const persistRef = useRef<() => Promise<boolean>>(async () => false)

  async function send(): Promise<boolean> {
    const snapshot = ballotRef.current
    if (!snapshot.id || !snapshot.name.trim()) return true
    if (snapshot.revision <= snapshot.savedRevision) return true
    const sendingRevision = snapshot.revision
    setSaveState("saving")
    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: snapshot.id,
          name: snapshot.name,
          team: snapshot.team,
          picks: snapshot.picks,
          overallComment: snapshot.overallComment,
          finished: snapshot.finished,
        }),
      })
      if (!response.ok) {
        setSaveState("error")
        return false
      }
      const current = ballotRef.current
      const savedRevision = Math.max(current.savedRevision, sendingRevision)
      if (current.savedRevision !== savedRevision) {
        const marked = { ...current, savedRevision }
        ballotRef.current = marked
        setBallot(marked)
        writeBallot(round.id, marked)
      }
      if (ballotRef.current.revision > ballotRef.current.savedRevision) return send()
      setSaveState("saved")
      return true
    } catch {
      setSaveState("error")
      return false
    }
  }

  function persistNow(): Promise<boolean> {
    const run = saveChain.current.then(() => send())
    saveChain.current = run.then(
      () => true,
      () => true,
    )
    return run
  }
  persistRef.current = persistNow

  function update(partial: Partial<Ballot>, mode: "now" | "soon"): Promise<boolean> {
    const current = ballotRef.current
    const next: Ballot = { ...current, ...partial, revision: current.revision + 1 }
    ballotRef.current = next
    setBallot(next)
    writeBallot(round.id, next)
    if (mode === "soon") {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        void persistRef.current()
      }, 400)
      return Promise.resolve(true)
    }
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    return persistRef.current()
  }

  function resume(next: Ballot) {
    if (next.finished) {
      setScreen("done")
      return
    }
    const firstOpen = round.designs.findIndex((design) => !next.picks[design.id]?.choice)
    if (firstOpen === -1) setScreen("wrapup")
    else {
      setIndex(firstOpen)
      setScreen("design")
    }
  }

  useEffect(() => {
    let ignore = false
    const activeRound = round
    async function boot() {
      const local = readBallot(activeRound)
      if (!local?.id || !local.name) {
        if (ignore) return
        if (local?.name) {
          setNameInput(local.name)
          setTeamInput(local.team)
        }
        setScreen("identify")
        return
      }
      try {
        const response = await fetch(`/api/vote?id=${encodeURIComponent(local.id)}`, { cache: "no-store" })
        if (ignore) return
        if (response.ok) {
          const server = (await response.json()) as Voter
          if (local.revision > local.savedRevision) {
            ballotRef.current = local
            setBallot(local)
            setWelcome(true)
            await persistRef.current()
            if (!ignore) resume(ballotRef.current)
          } else {
            const next = fromServer(activeRound, server, Math.max(local.revision, 1))
            ballotRef.current = next
            setBallot(next)
            writeBallot(activeRound.id, next)
            setWelcome(true)
            resume(next)
          }
          return
        }
        if (response.status === 404) {
          const forced = { ...local, revision: local.savedRevision + 1 }
          ballotRef.current = forced
          setBallot(forced)
          writeBallot(activeRound.id, forced)
          setWelcome(true)
          await persistRef.current()
          if (!ignore) resume(ballotRef.current)
          return
        }
        ballotRef.current = local
        setBallot(local)
        setWelcome(true)
        setSaveState("error")
        if (!ignore) resume(local)
      } catch {
        if (ignore) return
        ballotRef.current = local
        setBallot(local)
        setWelcome(true)
        setSaveState("error")
        resume(local)
      }
    }
    void boot()
    return () => {
      ignore = true
    }
    // The round config is fixed for this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id])

  useEffect(() => {
    const flush = () => {
      void persistRef.current()
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !zoom) return
    if (!dialog.open) dialog.showModal()
  }, [zoom])

  useEffect(() => {
    if (screen === "loading") return
    window.scrollTo(0, 0)
    document.getElementById("step-heading")?.focus()
  }, [screen, index])

  function choose(designId: string, choice: string) {
    const current = ballotRef.current
    const prev = current.picks[designId] ?? { choice: null, comment: "" }
    if (prev.choice === choice) return
    void update({ picks: { ...current.picks, [designId]: { ...prev, choice } } }, "now")
  }

  function comment(designId: string, text: string) {
    const current = ballotRef.current
    const prev = current.picks[designId] ?? { choice: null, comment: "" }
    void update({ picks: { ...current.picks, [designId]: { ...prev, comment: text } } }, "soon")
  }

  function goTo(nextScreen: Screen, nextIndex = index) {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    void persistRef.current()
    setZoom(null)
    setWelcome(false)
    setIndex(nextIndex)
    setScreen(nextScreen)
  }

  async function onStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = nameInput.replace(/\s+/g, " ").trim()
    const team = teamInput.replace(/\s+/g, " ").trim()
    if (!name) {
      setFormError("Add your name so we know whose picks these are.")
      return
    }
    if (name.length > LIMITS.name) {
      setFormError("That name is too long.")
      return
    }
    if (team.length > LIMITS.team) {
      setFormError("That team name is too long.")
      return
    }
    setFormError("")
    const id = ballotRef.current.id || crypto.randomUUID()
    const wasEditing = editingName
    const ok = await update({ id, name, team }, "now")
    if (!ok) {
      setFormError("We couldn't save that. Check your connection and try again.")
      return
    }
    setEditingName(false)
    if (wasEditing) goTo(returnTo.current.screen === "identify" ? "design" : returnTo.current.screen, returnTo.current.index)
    else goTo("design", 0)
  }

  function beginEditName() {
    returnTo.current = { screen, index }
    setNameInput(ballotRef.current.name)
    setTeamInput(ballotRef.current.team)
    setEditingName(true)
    setFormError("")
    setScreen("identify")
  }

  function startFresh() {
    try {
      localStorage.removeItem(storageKey(round.id))
    } catch {
      // Ignore storage failures.
    }
    const blank = emptyBallot()
    ballotRef.current = blank
    setBallot(blank)
    setNameInput("")
    setTeamInput("")
    setWelcome(false)
    setConfirmNew(false)
    setEditingName(false)
    setSaveState("idle")
    setFormError("")
    setScreen("identify")
  }

  async function finish() {
    const ok = await update({ finished: true }, "now")
    if (ok) goTo("done")
  }

  const design = round.designs[index]
  const pick = design ? ballot.picks[design.id] : undefined
  const answered = round.designs.filter((item) => ballot.picks[item.id]?.choice).length
  const openCount = round.designs.length - answered
  const nextDesign = screen === "design" ? round.designs[index + 1] : undefined

  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save." : ""

  return (
    <>
      <BrandHeader title={round.title} large={screen === "identify" || screen === "loading"}>
        {screen === "design" && design ? (
          <p className="progress-title" id="step-heading" tabIndex={-1}>
            Design {index + 1} of {round.designs.length}
          </p>
        ) : null}
        {screen === "wrapup" ? (
          <p className="progress-title" id="step-heading" tabIndex={-1}>
            Last step
          </p>
        ) : null}
        {screen === "done" ? (
          <p className="progress-title" id="step-heading" tabIndex={-1}>
            Done
          </p>
        ) : null}
        {screen === "design" || screen === "wrapup" || screen === "done" ? (
          <div className="segments" aria-hidden="true">
            {round.designs.map((item, itemIndex) => {
              const className = [
                "segment",
                ballot.picks[item.id]?.choice ? "answered" : "",
                screen === "design" && itemIndex === index ? "current" : "",
              ]
                .filter(Boolean)
                .join(" ")
              return <span className={className} key={item.id} />
            })}
          </div>
        ) : null}
        <p className="save-status" aria-live="polite">
          {saveLabel}{" "}
          {saveState === "error" ? (
            <button className="text-button" type="button" onClick={() => void persistRef.current()}>
              Retry
            </button>
          ) : null}
        </p>
      </BrandHeader>

      <main
        className={`wrap main${screen === "design" || screen === "wrapup" ? " has-nav" : ""}`}
        id="main"
        tabIndex={-1}
        data-testid={`screen-${screen}`}
      >
        {screen === "loading" ? <p>Loading your picks…</p> : null}

        {screen === "identify" ? (
          <div className="narrow">
            <p className="intro">{round.intro}</p>
            <form className="stack" onSubmit={onStart}>
              <label className="field" htmlFor="voter-name">
                <span>Your name</span>
                <input
                  id="voter-name"
                  name="name"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  maxLength={LIMITS.name}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  aria-invalid={formError ? true : undefined}
                  aria-describedby={formError ? "name-error" : undefined}
                />
              </label>
              <label className="field" htmlFor="voter-team">
                <span>Team or role, optional</span>
                <input
                  id="voter-team"
                  name="team"
                  value={teamInput}
                  onChange={(event) => setTeamInput(event.target.value)}
                  maxLength={LIMITS.team}
                  autoComplete="organization-title"
                  placeholder="Design, support, ops"
                />
              </label>
              {formError ? (
                <p className="form-error" id="name-error" role="alert">
                  {formError}
                </p>
              ) : null}
              <button className="button" type="submit">
                {editingName ? "Save and Continue" : "Start Voting"}
              </button>
              {editingName ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => goTo(returnTo.current.screen === "identify" ? "design" : returnTo.current.screen, returnTo.current.index)}
                >
                  Cancel
                </button>
              ) : null}
            </form>
          </div>
        ) : null}

        {screen !== "loading" && screen !== "identify" && ballot.name ? (
          <div className="who-row">
            {welcome ? (
              <p className="welcome">
                Welcome back, {ballot.name}. Your earlier picks are saved on this device.
              </p>
            ) : (
              <p className="who">
                Voting as {ballot.name}
                {ballot.team ? ` · ${ballot.team}` : ""}
              </p>
            )}
            <p className="who-actions">
              {welcome && answered > 0 && screen !== "done" ? (
                <button className="text-button" type="button" onClick={() => goTo("design", 0)}>
                  Review picks
                </button>
              ) : null}
              <button className="text-button" type="button" onClick={beginEditName}>
                Edit name
              </button>
              <button className="text-button" type="button" onClick={() => setConfirmNew(true)}>
                Not you?
              </button>
            </p>
            {confirmNew ? (
              <div className="confirm">
                <p>
                  Start a new ballot on this device? {ballot.name}&apos;s picks stay saved.
                </p>
                <button className="button secondary" type="button" onClick={startFresh}>
                  Start a New Ballot
                </button>
                <button className="button secondary" type="button" onClick={() => setConfirmNew(false)}>
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {screen === "design" && design ? (
          <>
            <div className="narrow">
              <h2>{design.title}</h2>
              <p className="hint">Open a picture to see it full size.</p>
            </div>
            <fieldset>
              <legend>Pick the take closest to Pupford</legend>
              <div className="takes">
                {design.takes.map((take) => {
                  const letter = takeLetter(take)
                  const selected = pick?.choice === take
                  return (
                    <div className={selected ? "take selected" : "take"} key={take} data-testid={`take-${take}`}>
                      <button
                        className="zoom-button"
                        type="button"
                        onClick={() => setZoom(take)}
                        aria-label={`View take ${letter} full size`}
                      >
                        <Image
                          src={`/illustrations/${take}.jpg`}
                          alt={`${design.title}, take ${letter}`}
                          fill
                          sizes="(max-width: 899px) calc(100vw - 2rem), 30vw"
                          quality={90}
                          priority={take === design.takes[0]}
                        />
                      </button>
                      <div className="take-meta">
                        <span className="letter">{letter}</span>
                        <TakeId id={take} />
                      </div>
                      <label className="pick">
                        <input
                          className="sr-only"
                          type="radio"
                          name={`design-${design.id}`}
                          value={take}
                          checked={selected}
                          onChange={() => choose(design.id, take)}
                        />
                        <span>{selected ? "Picked" : `Pick ${letter}`}</span>
                      </label>
                    </div>
                  )
                })}
              </div>
              <label className={pick?.choice === NONE ? "none selected" : "none"}>
                <input
                  className="sr-only"
                  type="radio"
                  name={`design-${design.id}`}
                  value={NONE}
                  checked={pick?.choice === NONE}
                  onChange={() => choose(design.id, NONE)}
                />
                <span className="mark" aria-hidden="true" />
                <span>None of these feel right</span>
              </label>
            </fieldset>
            <label className="field comment-field" htmlFor="design-comment">
              <span>What do you think? Optional</span>
              <textarea
                id="design-comment"
                value={pick?.comment ?? ""}
                onChange={(event) => comment(design.id, event.target.value)}
                maxLength={LIMITS.comment}
                placeholder="What's working, or what feels off?"
              />
            </label>
            {nextDesign ? (
              <div className="prefetch" aria-hidden="true">
                {nextDesign.takes.map((take) => (
                  <Image
                    key={take}
                    src={`/illustrations/${take}.jpg`}
                    alt=""
                    width={1024}
                    height={1024}
                    sizes="(max-width: 899px) calc(100vw - 2rem), 30vw"
                    quality={90}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {screen === "wrapup" ? (
          <div className="narrow">
            <h2>Anything Else?</h2>
            <p>
              {openCount > 0
                ? `You left ${openCount} ${openCount === 1 ? "design" : "designs"} open. That's fine. You can go back, or finish from here.`
                : "You picked a take for every design."}
            </p>
            <label className="field" htmlFor="overall-comment">
              <span>Overall comment, optional</span>
              <textarea
                id="overall-comment"
                value={ballot.overallComment}
                onChange={(event) => void update({ overallComment: event.target.value }, "soon")}
                maxLength={LIMITS.overall}
                placeholder="The style feels close, or here's what still feels off."
              />
            </label>
          </div>
        ) : null}

        {screen === "done" ? (
          <div className="narrow">
            <h2>Thanks, {ballot.name}</h2>
            <p>Your picks are in. You can come back on this device anytime to see them or change them.</p>
            <p className="picked-count">
              You picked {answered} of {round.designs.length} designs.
            </p>
            {ballot.overallComment.trim() ? (
              <blockquote>
                <p>{ballot.overallComment}</p>
                <footer>Your overall note</footer>
              </blockquote>
            ) : null}
            <ol className="summary">
              {round.designs.map((item, itemIndex) => (
                <li key={item.id}>
                  <span className="summary-title">
                    {itemIndex + 1}. {item.title}
                  </span>
                  <span className="summary-choice">
                    {ballot.picks[item.id]?.choice && ballot.picks[item.id]?.choice !== NONE ? (
                      <>
                        {takeLetter(ballot.picks[item.id]?.choice ?? "")} ·{" "}
                        <TakeId id={ballot.picks[item.id]?.choice ?? ""} />
                      </>
                    ) : (
                      choiceText(ballot.picks[item.id]?.choice)
                    )}
                  </span>
                  {ballot.picks[item.id]?.comment ? (
                    <span className="summary-comment">{ballot.picks[item.id]?.comment}</span>
                  ) : null}
                </li>
              ))}
            </ol>
            <button className="button" type="button" onClick={() => goTo("design", 0)}>
              Edit My Picks
            </button>
          </div>
        ) : null}

        {screen === "design" && design ? (
          <div className="nav-bar">
            <div className="nav-inner">
              <button
                className="button secondary"
                type="button"
                onClick={() => goTo("design", index - 1)}
                disabled={index === 0}
              >
                Back
              </button>
              {index < round.designs.length - 1 ? (
                <button className="button secondary" type="button" onClick={() => goTo("design", index + 1)}>
                  Skip for Now
                </button>
              ) : (
                <span />
              )}
              <button
                className="button next"
                type="button"
                onClick={() =>
                  index < round.designs.length - 1 ? goTo("design", index + 1) : goTo("wrapup")
                }
              >
                {index < round.designs.length - 1 ? "Next" : "Continue"}
              </button>
            </div>
          </div>
        ) : null}

        {screen === "wrapup" ? (
          <div className="nav-bar">
            <div className="nav-inner two">
              <button
                className="button secondary"
                type="button"
                onClick={() => goTo("design", round.designs.length - 1)}
              >
                Back
              </button>
              <button className="button next" type="button" onClick={() => void finish()} disabled={saveState === "saving"}>
                {ballot.finished ? "Save" : "Finish"}
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {zoom && design ? (
        <dialog
          ref={dialogRef}
          className="lightbox"
          aria-label={`Take ${takeLetter(zoom)} full size`}
          onClose={() => setZoom(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setZoom(null)
          }}
        >
          <div className="lightbox-inner">
            {/* The lightbox shows the original file, not a resized copy. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/illustrations/${zoom}.jpg`}
              alt={`${design.title}, take ${takeLetter(zoom)}, full size`}
              width={1024}
              height={1024}
            />
            <p className="lightbox-caption">
              <span className="letter">{takeLetter(zoom)}</span>
              <TakeId id={zoom} />
            </p>
            <div className="lightbox-actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  choose(design.id, zoom)
                  setZoom(null)
                }}
              >
                {pick?.choice === zoom ? "Picked" : `Pick ${takeLetter(zoom)}`}
              </button>
              <button className="button secondary" type="button" onClick={() => setZoom(null)}>
                Close
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  )
}
