import type { Aviso } from './comun.ts'

export function LineaAviso({ aviso, id }: { aviso: Aviso | null; id?: string }) {
  if (!aviso) return null
  return aviso.tipo === 'bien' ? (
    <p id={id} role="status" className="text-sm">
      {aviso.texto}
    </p>
  ) : (
    <p id={id} role="alert" className="text-sm font-medium text-red-800">
      {aviso.texto}
    </p>
  )
}
