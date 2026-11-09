import type { Aviso } from './comun.ts'

export function LineaAviso({ aviso }: { aviso: Aviso | null }) {
  if (!aviso) return null
  return aviso.tipo === 'bien' ? (
    <p role="status" className="text-sm">
      {aviso.texto}
    </p>
  ) : (
    <p role="alert" className="text-sm font-medium text-red-800">
      {aviso.texto}
    </p>
  )
}
