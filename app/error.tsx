"use client"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap main narrow" id="main" tabIndex={-1}>
      <h1 className="brand-title is-landing">Something Went Wrong</h1>
      <p>Try that again. Picks saved on this device are still here.</p>
      <button className="button" type="button" onClick={reset}>
        Try Again
      </button>
    </main>
  )
}
