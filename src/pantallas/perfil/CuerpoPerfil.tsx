import { useState, type SubmitEvent } from 'react'
import {
  COMPLEXIONES,
  cuerpoSchema,
  MEDIDAS,
  type Complexion,
  type Cuerpo,
  type Medida,
} from '../../datos/modelo.ts'
import { botonPrincipal, campoTexto, claseChip, type Aviso } from './comun.ts'
import { LineaAviso } from './LineaAviso.tsx'

interface Props {
  cuerpo: Cuerpo | undefined
  guardar: (cuerpo: Cuerpo | undefined) => Promise<void>
}

const CAMPOS: { medida: Medida; nombre: string; ayuda: string }[] = [
  {
    medida: 'altura',
    nombre: 'Altura',
    ayuda: 'Descalzo, de espaldas a una pared y con los talones juntos. Marca encima de la cabeza.',
  },
  {
    medida: 'peso',
    nombre: 'Peso',
    ayuda: 'En la báscula, por la mañana y con ropa ligera.',
  },
  {
    medida: 'pecho',
    nombre: 'Pecho',
    ayuda: 'La cinta por la parte más ancha, bajo las axilas, recta por la espalda. Sin apretar.',
  },
  {
    medida: 'cintura',
    nombre: 'Cintura',
    ayuda: 'La cinta a la altura del ombligo, sin meter tripa ni apretar.',
  },
  {
    medida: 'cadera',
    nombre: 'Cadera',
    ayuda: 'Con los pies juntos, la cinta por la parte más ancha del culo.',
  },
  {
    medida: 'largoPierna',
    nombre: 'Largo de pierna',
    ayuda: 'Descalzo, por dentro de la pierna: de la entrepierna al suelo.',
  },
]

const SOLO_NUMERO = /^\d{1,3}([.,]\d{1,2})?$/

function texto(valor: number | undefined): string {
  return valor === undefined ? '' : String(valor).replace('.', ',')
}

/** Lee lo escrito: vacío es «sin medida»; «84,5» vale igual que «84.5». */
function leerNumero(escrito: string): number | undefined | null {
  const limpio = escrito.trim()
  if (limpio === '') return undefined
  if (!SOLO_NUMERO.test(limpio)) return null
  return Number(limpio.replace(',', '.'))
}

type Errores = Partial<Record<Medida | 'notas', string>>

export function CuerpoPerfil({ cuerpo, guardar }: Props) {
  const [textos, setTextos] = useState<Record<Medida, string>>(() => ({
    altura: texto(cuerpo?.altura),
    peso: texto(cuerpo?.peso),
    pecho: texto(cuerpo?.pecho),
    cintura: texto(cuerpo?.cintura),
    cadera: texto(cuerpo?.cadera),
    largoPierna: texto(cuerpo?.largoPierna),
  }))
  const [complexion, setComplexion] = useState<Complexion | undefined>(cuerpo?.complexion)
  const [notas, setNotas] = useState(cuerpo?.notas ?? '')
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  async function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAviso(null)
    const nuevos: Errores = {}
    // Solo se guardan las claves con valor, para que la copia y la fusión no vean medidas «vacías».
    const candidato: Record<string, unknown> = {}
    for (const { medida } of CAMPOS) {
      const valor = leerNumero(textos[medida])
      if (valor === null) nuevos[medida] = 'Escribe solo el número, por ejemplo 84 o 84,5.'
      else if (valor !== undefined) candidato[medida] = valor
    }
    if (complexion) candidato.complexion = complexion
    if (notas.trim()) candidato.notas = notas
    const resultado = cuerpoSchema.safeParse(candidato)
    if (!resultado.success) {
      for (const problema of resultado.error.issues) {
        const campo = problema.path[0] as Medida | 'notas'
        nuevos[campo] ??= problema.message
      }
    }
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0 || !resultado.success) {
      setAviso({ tipo: 'error', texto: 'Revisa las medidas marcadas.' })
      return
    }
    const datos = resultado.data
    setGuardando(true)
    try {
      await guardar(Object.keys(datos).length > 0 ? datos : undefined)
      setAviso({ tipo: 'bien', texto: 'Medidas guardadas.' })
    } catch (error) {
      console.error(error)
      setAviso({ tipo: 'error', texto: 'No se han podido guardar las medidas.' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        void enviar(evento)
      }}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {CAMPOS.map(({ medida, nombre, ayuda }) => {
          const id = `medida-${medida}`
          const error = errores[medida]
          return (
            <div key={medida} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={id} className="text-sm font-medium">
                {nombre}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={textos[medida]}
                  disabled={guardando}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(evento) => {
                    const valor = evento.target.value
                    setTextos((actuales) => ({ ...actuales, [medida]: valor }))
                  }}
                  className={campoTexto}
                />
                <span className="text-sm text-suave">{MEDIDAS[medida].unidad}</span>
              </div>
              {error && (
                <p id={`${id}-error`} className="text-xs font-medium text-red-800">
                  {error}
                </p>
              )}
              <details className="text-xs text-suave">
                <summary className="min-h-8 cursor-pointer content-center">Cómo medirte</summary>
                <p>{ayuda}</p>
              </details>
            </div>
          )
        })}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Complexión</legend>
        <div className="flex flex-wrap gap-2">
          {COMPLEXIONES.map((una) => (
            <button
              key={una}
              type="button"
              aria-pressed={complexion === una}
              disabled={guardando}
              className={claseChip(complexion === una)}
              onClick={() => {
                setComplexion((actual) => (actual === una ? undefined : una))
              }}
            >
              {una}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="cuerpo-notas" className="text-sm font-medium">
          Algo más de tu cuerpo
        </label>
        <input
          id="cuerpo-notas"
          type="text"
          value={notas}
          maxLength={120}
          placeholder="Por ejemplo, hombros anchos, muslo grande"
          disabled={guardando}
          onChange={(evento) => {
            setNotas(evento.target.value)
          }}
          className={campoTexto}
        />
      </div>

      <button type="submit" className={botonPrincipal} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar medidas'}
      </button>
      <LineaAviso aviso={aviso} />
    </form>
  )
}
