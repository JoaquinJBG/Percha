import type { ReactNode } from 'react'

interface Props {
  titulo: string
  children?: ReactNode
}

export function Pantalla({ titulo, children }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      {children}
    </section>
  )
}
