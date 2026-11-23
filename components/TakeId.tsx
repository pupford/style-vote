export function TakeId({ id }: { id: string }) {
  return (
    <span className="take-id">
      {Array.from(id).map((char, index) =>
        char === "0" ? (
          <span className="digit-zero" key={`${char}-${index}`}>
            0
          </span>
        ) : (
          <span key={`${char}-${index}`}>{char}</span>
        ),
      )}
    </span>
  )
}
