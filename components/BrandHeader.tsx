import type { ReactNode } from "react"

export function BrandHeader({
  title,
  large = false,
  children,
}: {
  title: string
  large?: boolean
  children?: ReactNode
}) {
  return (
    <header className="site-header">
      <div className="wrap">
        <h1 className={large ? "brand-title is-landing" : "brand-title"}>{title}</h1>
        {children}
      </div>
    </header>
  )
}
