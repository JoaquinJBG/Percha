import type { ReactNode } from 'react'

interface Props {
  titulo: string
  children?: ReactNode
}

export function Pantalla({ titulo, children }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-titulo text-3xl font-semibold tracking-tight">{titulo}</h1>
      {children}
    </section>
  )
}
