import { useState, type SubmitEvent } from 'react'
import {
  MAX_TALLAS,
  TIPOS_TALLA,
  tallaMarcaSchema,
  type TallaMarca,
  type TipoTalla,
} from '../../datos/modelo.ts'
import { botonPrincipal, campoTexto, type Aviso } from './comun.ts'
import { LineaAviso } from './LineaAviso.tsx'

interface Props {
  tallas: TallaMarca[]
  guardar: (tallas: TallaMarca[]) => Promise<void>
}

function nombre({ marca, tipo, talla }: TallaMarca): string {
  return `${marca} · ${tipo} · ${talla}`
}

function mismaMarcaYTipo(a: TallaMarca, b: TallaMarca): boolean {
  return a.tipo === b.tipo && a.marca.toLocaleLowerCase('es') === b.marca.toLocaleLowerCase('es')
}

export function TallasPerfil({ tallas, guardar }: Props) {
  const [marca, setMarca] = useState('')
  const [tipo, setTipo] = useState<TipoTalla>('parte de arriba')
  const [talla, setTalla] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  async function cambiar(nuevas: TallaMarca[], hecho: string): Promise<boolean> {
    setGuardando(true)
    setAviso(null)
    try {
      await guardar(nuevas)
      setAviso({ tipo: 'bien', texto: hecho })
      return true
    } catch (error) {
      console.error(error)
      setAviso({ tipo: 'error', texto: 'No se han podido guardar las tallas.' })
      return false
    } finally {
      setGuardando(false)
    }
  }

  async function añadir(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    const resultado = tallaMarcaSchema.safeParse({ marca, tipo, talla })
    if (!resultado.success) {
      setAviso({ tipo: 'error', texto: 'Escribe la marca y la talla.' })
      return
    }
    const nueva = resultado.data
    // Una marca y un tipo solo tienen una talla: si ya estaba, se cambia en su sitio.
    const yaEstaba = tallas.some((una) => mismaMarcaYTipo(una, nueva))
    if (!yaEstaba && tallas.length >= MAX_TALLAS) {
      setAviso({ tipo: 'error', texto: `Como mucho ${String(MAX_TALLAS)} tallas.` })
      return
    }
    const nuevas = yaEstaba
      ? tallas.map((una) => (mismaMarcaYTipo(una, nueva) ? nueva : una))
      : [...tallas, nueva]
    const guardadas = await cambiar(
      nuevas,
      yaEstaba ? `Talla cambiada: ${nombre(nueva)}.` : `Talla añadida: ${nombre(nueva)}.`,
    )
    if (guardadas) {
      setMarca('')
      setTalla('')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {tallas.length === 0 ? (
        <p className="text-sm text-suave">Aún no has puesto ninguna.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tallas.map((una, indice) => (
            <li
              key={`${String(indice)}-${una.marca}-${una.tipo}`}
              className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-white px-3 shadow-tarjeta"
            >
              <span className="min-w-0 break-words">{nombre(una)}</span>
              <button
                type="button"
                className="min-h-10 shrink-0 px-1 text-sm text-suave underline disabled:opacity-50"
                aria-label={`Quitar ${nombre(una)}`}
                disabled={guardando}
                onClick={() =>
                  void cambiar(
                    tallas.filter((_, otro) => otro !== indice),
                    `Talla quitada: ${nombre(una)}.`,
                  )
                }
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(evento) => {
          void añadir(evento)
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-sm font-medium">Marca</span>
            <input
              type="text"
              value={marca}
              maxLength={40}
              placeholder="Por ejemplo, Zara"
              disabled={guardando}
              onChange={(evento) => {
                setMarca(evento.target.value)
              }}
              className={campoTexto}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium">Tipo</span>
            <select
              value={tipo}
              disabled={guardando}
              onChange={(evento) => {
                setTipo(evento.target.value as TipoTalla)
              }}
              className={campoTexto}
            >
              {TIPOS_TALLA.map((uno) => (
                <option key={uno} value={uno}>
                  {uno}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium">Talla</span>
            <input
              type="text"
              value={talla}
              maxLength={20}
              placeholder="44, L, 45…"
              disabled={guardando}
              onChange={(evento) => {
                setTalla(evento.target.value)
              }}
              className={campoTexto}
            />
          </label>
        </div>
        <button type="submit" className={botonPrincipal} disabled={guardando}>
          Añadir talla
        </button>
      </form>
      <LineaAviso aviso={aviso} />
    </div>
  )
}
