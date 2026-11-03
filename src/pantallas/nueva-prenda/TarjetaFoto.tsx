import type { CSSProperties } from 'react'
import type { ProgresoCarga } from '../../recorte/index.ts'

export type EstadoFoto =
  | { fase: 'preparando' }
  | { fase: 'recortando'; progreso: ProgresoCarga | null }
  | { fase: 'recortada'; recortada: Blob; urlRecortada: string }
  | { fase: 'fallida' }

export interface FotoNueva {
  id: number
  original: Blob | null
  urlOriginal: string | null
  estado: EstadoFoto
  usarOriginal: boolean
}

interface Props {
  foto: FotoNueva
  numero: number
  onUsarOriginal: (usar: boolean) => void
  onReintentar: () => void
  onQuitar: () => void
}

// Cuadros grises para que se vea qué parte del recorte es transparente.
const fondoCuadros: CSSProperties = {
  backgroundImage: 'conic-gradient(#e7e2db 25%, #ffffff 0 50%, #e7e2db 0 75%, #ffffff 0)',
  backgroundSize: '16px 16px',
}

const megas = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

function textoEstado(estado: EstadoFoto, usarOriginal: boolean): string {
  switch (estado.fase) {
    case 'preparando':
      return 'Preparando la foto…'
    case 'recortando': {
      if (usarOriginal) return 'Se guardará sin recortar'
      const { progreso } = estado
      if (progreso && progreso.total > 0 && progreso.cargados < progreso.total) {
        return `Cargando el recortador: ${megas.format(progreso.cargados / 1e6)} de ${megas.format(progreso.total / 1e6)} MB`
      }
      return 'Quitando el fondo…'
    }
    case 'recortada':
      return usarOriginal ? 'Se guardará sin recortar' : 'Fondo quitado'
    case 'fallida':
      return 'No se pudo quitar el fondo. Se guardará sin recortar.'
  }
}

export function TarjetaFoto({ foto, numero, onUsarOriginal, onReintentar, onQuitar }: Props) {
  const { estado, usarOriginal } = foto
  const verRecorte = estado.fase === 'recortada' && !usarOriginal
  const url = verRecorte ? estado.urlRecortada : foto.urlOriginal
  const progreso = estado.fase === 'recortando' ? estado.progreso : null
  const ocupada = estado.fase === 'preparando' || estado.fase === 'recortando'

  return (
    <li className="flex flex-col gap-2">
      <div
        className="relative aspect-square overflow-hidden rounded-xl border border-tinta/15"
        style={fondoCuadros}
      >
        {url && (
          <img
            src={url}
            alt={`Foto ${String(numero)}${verRecorte ? ', sin fondo' : ''}`}
            className={`h-full w-full object-contain ${ocupada ? 'opacity-60' : ''}`}
          />
        )}
        {ocupada && (
          <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-papel/80">
            <div
              className={`h-full bg-tinta ${progreso && progreso.total > 0 ? '' : 'w-1/3 animate-pulse'}`}
              style={
                progreso && progreso.total > 0
                  ? { width: `${String(Math.round((100 * progreso.cargados) / progreso.total))}%` }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      <p role="status" className="text-sm text-suave">
        {textoEstado(estado, usarOriginal)}
      </p>
      {progreso && progreso.cargados < progreso.total && (
        <p className="text-xs text-suave">Solo la primera vez. Mejor con wifi.</p>
      )}

      {foto.original && estado.fase !== 'fallida' && (
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-tinta"
            checked={usarOriginal}
            onChange={(evento) => {
              onUsarOriginal(evento.target.checked)
            }}
          />
          Usar la original
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {estado.fase === 'fallida' && (
          <button
            type="button"
            className="min-h-10 rounded-lg border border-tinta/25 px-3 text-sm"
            onClick={onReintentar}
          >
            Reintentar
          </button>
        )}
        <button
          type="button"
          className="min-h-10 rounded-lg px-1 text-sm text-suave underline"
          aria-label={`Quitar la foto ${String(numero)}`}
          onClick={onQuitar}
        >
          Quitar
        </button>
      </div>
    </li>
  )
}
