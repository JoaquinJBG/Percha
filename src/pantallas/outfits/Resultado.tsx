import { useEffect, useMemo, useRef, useState } from 'react'
import { BotonPruebatelo } from '../../componentes/BotonPruebatelo.tsx'
import type { NuevoOutfit, Outfit, Prenda } from '../../datos/modelo.ts'
import { TIPO_COLLAGE, type OutfitCollage } from '../../outfits/collage/index.ts'
import type { ResultadoOutfits } from '../../outfits/reglas/index.ts'
import type { ResultadoSelector } from './selector.ts'

export type Compartidor = Partial<Pick<Navigator, 'share' | 'canShare'>>

export interface AccionesResultado {
  componer: (outfits: OutfitCollage[]) => Promise<Blob>
  guardar: (outfit: NuevoOutfit) => Promise<Outfit>
  marcar: (id: string, favorito: boolean) => Promise<void>
  /** Guarda con un outfit ya guardado la foto del probador del PC (T7.1). */
  guardarPrueba: (id: string, prueba: Blob) => Promise<void>
  compartidor: Compartidor
}

interface Props extends AccionesResultado {
  resultado: Pick<ResultadoSelector, 'contexto' | 'outfits'>
  nombreFichero: string
  /** Avisa mientras se guarda, para no dejar generar otra tanda a medias. */
  alOcupar?: (ocupado: boolean) => void
}

type Collage =
  { fase: 'dibujando' } | { fase: 'error' } | { fase: 'listo'; blob: Blob; url: string }

function aNuevoOutfit(
  outfit: ResultadoOutfits<Prenda>['outfits'][number],
  contexto: ResultadoOutfits<Prenda>['contexto'],
  favorito: boolean,
): NuevoOutfit {
  return {
    prendas: outfit.prendas.map((p) => p.id),
    estilo: contexto.estilo,
    ocasion: contexto.ocasion,
    tiempo:
      contexto.temperatura === null
        ? null
        : { temperatura: contexto.temperatura, lluvia: contexto.precipitacion !== null },
    explicacion: outfit.motivo,
    favorito,
  }
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1)
}

function esCancelacion(fallo: unknown): boolean {
  return fallo instanceof DOMException && fallo.name === 'AbortError'
}

/**
 * El collage, los motivos y las acciones de una tanda de outfits. Se monta con una `key` por tanda: al
 * generar otra, todo su estado (lo guardado, el collage) empieza de cero.
 */
export function Resultado({
  resultado,
  nombreFichero,
  componer,
  guardar,
  marcar,
  guardarPrueba,
  compartidor,
  alOcupar,
}: Props) {
  const { outfits, contexto } = resultado
  const [collage, setCollage] = useState<Collage>({ fase: 'dibujando' })
  const [guardados, setGuardados] = useState<(Outfit | undefined)[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  // El estado tarda un render en verse: esto evita que dos toques seguidos guarden dos veces.
  const enCurso = useRef(false)
  const compartiendo = useRef(false)

  useEffect(() => {
    let vigente = true
    let url: string | null = null
    componer(outfits.map((o) => ({ prendas: o.prendas, motivo: o.motivo }))).then(
      (blob) => {
        if (!vigente) return
        url = URL.createObjectURL(blob)
        setCollage({ fase: 'listo', blob, url })
      },
      (fallo: unknown) => {
        console.error(fallo)
        if (vigente) setCollage({ fase: 'error' })
      },
    )
    return () => {
      vigente = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [componer, outfits])

  /** `true` si la tarea se hizo; `false` si falló o había otra en marcha. */
  async function ocupar(tarea: () => Promise<void>, error: string): Promise<boolean> {
    if (enCurso.current) return false
    enCurso.current = true
    setOcupado(true)
    alOcupar?.(true)
    setMensaje(null)
    try {
      await tarea()
      return true
    } catch (fallo) {
      console.error(fallo)
      setMensaje(error)
      return false
    } finally {
      enCurso.current = false
      setOcupado(false)
      alOcupar?.(false)
    }
  }

  const todosGuardados = outfits.every((_, i) => guardados[i])

  function guardarTodos() {
    return ocupar(async () => {
      // Uno a uno y apuntando cada uno: si falla a medias, reintentar no duplica los ya guardados.
      for (const [i, outfit] of outfits.entries()) {
        if (guardados[i]) continue
        const guardado = await guardar(aNuevoOutfit(outfit, contexto, false))
        setGuardados((antes) => Object.assign([...antes], { [i]: guardado }))
      }
      setMensaje(outfits.length === 1 ? 'Outfit guardado.' : 'Outfits guardados.')
    }, 'No se han podido guardar. Prueba otra vez.')
  }

  /** La foto del probador va con el outfit: si aún no estaba guardado, se guarda con ella. */
  function guardarConPrueba(i: number, prueba: Blob) {
    const outfit = outfits[i]
    if (!outfit) return Promise.resolve(false)
    return ocupar(async () => {
      const guardado = guardados[i]
      const actualizado = guardado
        ? await guardarPrueba(guardado.id, prueba).then(() => ({ ...guardado, prueba }))
        : await guardar({ ...aNuevoOutfit(outfit, contexto, false), prueba })
      setGuardados((antes) => Object.assign([...antes], { [i]: actualizado }))
    }, 'No se ha podido guardar la prueba. Prueba otra vez.')
  }

  function cambiarFavorito(i: number) {
    const outfit = outfits[i]
    if (!outfit) return Promise.resolve(false)
    return ocupar(async () => {
      const guardado = guardados[i]
      const actualizado = guardado
        ? await marcar(guardado.id, !guardado.favorito).then(() => ({
            ...guardado,
            favorito: !guardado.favorito,
          }))
        : await guardar(aNuevoOutfit(outfit, contexto, true))
      setGuardados((antes) => Object.assign([...antes], { [i]: actualizado }))
    }, 'No se ha podido cambiar el favorito. Prueba otra vez.')
  }

  const fichero = useMemo(
    () =>
      collage.fase === 'listo'
        ? new File([collage.blob], nombreFichero, { type: TIPO_COLLAGE })
        : null,
    [collage, nombreFichero],
  )
  const puedeCompartir =
    fichero !== null &&
    typeof compartidor.share === 'function' &&
    (compartidor.canShare?.({ files: [fichero] }) ?? false)

  async function compartir() {
    // Un segundo `share()` con la hoja aún abierta falla: se ignora el toque.
    if (!fichero || !compartidor.share || compartiendo.current) return
    compartiendo.current = true
    setMensaje(null)
    try {
      await compartidor.share({ files: [fichero], title: 'Mis outfits de Percha' })
    } catch (fallo) {
      if (esCancelacion(fallo)) return
      console.error(fallo)
      setMensaje('No se ha podido compartir. Descarga la imagen y compártela desde la galería.')
    } finally {
      compartiendo.current = false
    }
  }

  return (
    <section aria-labelledby="resultado-outfits" className="flex flex-col gap-3">
      <h2 id="resultado-outfits" className="font-titulo text-xl font-semibold">
        Tus outfits
      </h2>

      <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-white shadow-tarjeta">
        {collage.fase === 'listo' && (
          <img
            src={collage.url}
            alt={`Collage con ${String(outfits.length)} ${outfits.length === 1 ? 'outfit' : 'outfits'}`}
            className="h-full w-full object-contain"
          />
        )}
        {collage.fase === 'dibujando' && (
          <p className="grid h-full place-items-center text-suave">Preparando la imagen…</p>
        )}
        {collage.fase === 'error' && (
          <p role="alert" className="grid h-full place-items-center px-4 text-center">
            No se ha podido dibujar la imagen.
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {outfits.map((outfit, i) => {
          const favorito = guardados[i]?.favorito ?? false
          return (
            <li key={i} className="flex flex-col gap-2 rounded-2xl bg-white shadow-tarjeta p-3">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-oliva text-sm font-semibold text-papel"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{conMayuscula(outfit.motivo)}</p>
                  <p className="text-xs text-suave">
                    {outfit.origen === 'ia' ? 'Elegido por Gemini' : 'Elegido por las reglas'}
                  </p>
                </div>
              </div>
              {/* Los botones van debajo: a su lado, el texto quedaba en una columna de una palabra por línea. */}
              <div className="flex items-center justify-end gap-2">
                <BotonPruebatelo
                  prendas={outfit.prendas}
                  numero={i + 1}
                  alGuardarPrueba={(prueba) => guardarConPrueba(i, prueba)}
                />
                <button
                  type="button"
                  onClick={() => void cambiarFavorito(i)}
                  disabled={ocupado}
                  aria-pressed={favorito}
                  aria-label={`Favorito: outfit ${String(i + 1)}`}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-2xl disabled:opacity-60"
                >
                  <span aria-hidden="true" className={favorito ? 'text-acento' : 'text-suave'}>
                    {favorito ? '★' : '☆'}
                  </span>
                </button>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void guardarTodos()}
          disabled={ocupado || todosGuardados}
          className="col-span-2 min-h-11 rounded-xl bg-oliva px-4 font-medium text-papel disabled:opacity-60"
        >
          {todosGuardados ? 'Guardados' : 'Guardar'}
        </button>
        {collage.fase === 'listo' ? (
          <a
            href={collage.url}
            download={nombreFichero}
            className={`grid min-h-11 place-items-center rounded-xl border border-tinta px-4 font-medium ${puedeCompartir ? '' : 'col-span-2'}`}
          >
            Descargar
          </a>
        ) : null}
        {puedeCompartir && (
          <button
            type="button"
            onClick={() => void compartir()}
            className="min-h-11 rounded-xl border border-tinta px-4 font-medium"
          >
            Compartir
          </button>
        )}
      </div>

      <div aria-live="polite" className="text-sm">
        {mensaje && <p>{mensaje}</p>}
      </div>
    </section>
  )
}
