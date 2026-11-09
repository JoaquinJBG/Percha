import { useState } from 'react'
import {
  SENSACIONES_TERMICAS,
  TIPOS_OFICINA,
  type Oficina,
  type SensacionTermica,
} from '../../datos/modelo.ts'
import { claseChip, type Aviso } from './comun.ts'
import { LineaAviso } from './LineaAviso.tsx'

interface Props {
  oficina: Oficina | undefined
  sensacionTermica: SensacionTermica | undefined
  guardarOficina: (oficina: Oficina | undefined) => Promise<void>
  guardarSensacion: (sensacion: SensacionTermica | undefined) => Promise<void>
}

const AYUDA_OFICINA: Record<Oficina['tipo'], string> = {
  conservadora: 'traje o americana casi siempre',
  estándar: 'camisa o polo, sin corbata',
  creativa: 'casi todo vale',
}

export function TrabajoPerfil({
  oficina,
  sensacionTermica,
  guardarOficina,
  guardarSensacion,
}: Props) {
  // Una cosa a la vez: así dos toques seguidos no se pisan al guardar.
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  async function cambiar(tarea: () => Promise<void>) {
    setGuardando(true)
    setAviso(null)
    try {
      await tarea()
    } catch (error) {
      console.error(error)
      setAviso({ tipo: 'error', texto: 'No se ha podido guardar el cambio.' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Tu oficina</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_OFICINA.map((tipo) => {
            const marcada = oficina?.tipo === tipo
            return (
              <button
                key={tipo}
                type="button"
                aria-pressed={marcada}
                disabled={guardando}
                className={claseChip(marcada)}
                onClick={() =>
                  void cambiar(() =>
                    guardarOficina(
                      marcada
                        ? undefined
                        : { tipo, viernesCasual: oficina?.viernesCasual ?? false },
                    ),
                  )
                }
              >
                {tipo}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-suave">
          {oficina
            ? `Oficina ${oficina.tipo}: ${AYUDA_OFICINA[oficina.tipo]}.`
            : 'Si no vas a una oficina, déjalo sin marcar.'}
        </p>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-oliva"
            checked={oficina?.viernesCasual ?? false}
            disabled={guardando || !oficina}
            onChange={(evento) => {
              const viernesCasual = evento.target.checked
              if (oficina) void cambiar(() => guardarOficina({ ...oficina, viernesCasual }))
            }}
          />
          Hay viernes casual
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">¿Cómo llevas el calor?</legend>
        <div className="flex flex-wrap gap-2">
          {SENSACIONES_TERMICAS.map((sensacion) => {
            const marcada = sensacionTermica === sensacion
            return (
              <button
                key={sensacion}
                type="button"
                aria-pressed={marcada}
                disabled={guardando}
                className={claseChip(marcada)}
                onClick={() =>
                  void cambiar(() => guardarSensacion(marcada ? undefined : sensacion))
                }
              >
                {sensacion}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-suave">
          Caluroso si sueles pasar calor cuando otros van bien; friolero si es al revés.
        </p>
      </fieldset>
      <LineaAviso aviso={aviso} />
    </div>
  )
}
