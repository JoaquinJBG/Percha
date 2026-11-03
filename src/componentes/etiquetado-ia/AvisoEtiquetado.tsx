import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { AvisoIA } from './etiquetado.ts'

interface Props {
  aviso: AvisoIA
  onReintentar?: () => void
  /** Una línea más bajo el texto, p. ej. qué pasa si se va ahora a Ajustes. */
  nota?: ReactNode
  /** Si no lo provoca lo que acaba de hacer el usuario, no interrumpe al lector de pantalla. */
  discreto?: boolean
}

const enlace =
  'inline-flex min-h-11 items-center rounded-xl border border-amber-900/30 px-3 font-medium focus-visible:outline-2 focus-visible:outline-amber-900'

export function AvisoEtiquetado({ aviso, onReintentar, nota, discreto = false }: Props) {
  return (
    <div
      role={discreto ? 'status' : 'alert'}
      className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
    >
      <p className="font-semibold">{aviso.titulo}</p>
      <p>{aviso.texto}</p>
      {nota && <p>{nota}</p>}
      {(aviso.ajustes || (aviso.reintentar && onReintentar)) && (
        <div className="flex flex-wrap gap-2">
          {aviso.ajustes && (
            <Link to="/ajustes" className={enlace}>
              Ir a Ajustes
            </Link>
          )}
          {aviso.reintentar && onReintentar && (
            <button type="button" className={enlace} onClick={onReintentar}>
              Probar otra vez
            </button>
          )}
        </div>
      )}
    </div>
  )
}
