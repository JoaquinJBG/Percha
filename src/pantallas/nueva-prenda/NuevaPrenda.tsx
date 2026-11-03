import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import { CATEGORIAS, type Categoria, type NuevaPrenda as DatosPrenda } from '../../datos/modelo.ts'
import { crearPrenda } from '../../datos/repositorio.ts'
import {
  ErrorFoto,
  normalizarFoto,
  recortar as recortarPorDefecto,
  type Recortar,
} from '../../recorte/index.ts'
import { TarjetaFoto, type EstadoFoto, type FotoNueva } from './TarjetaFoto.tsx'

interface Props {
  recortar?: Recortar
  normalizar?: (foto: Blob) => Promise<Blob>
  guardar?: (prenda: DatosPrenda) => Promise<unknown>
}

const MAX_FOTOS = 2

const NOMBRES_CATEGORIA: Record<Categoria, string> = {
  superior: 'Parte de arriba',
  inferior: 'Parte de abajo',
  vestido: 'Vestido',
  abrigo: 'Abrigo',
  calzado: 'Calzado',
  accesorio: 'Accesorio',
}

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta'
const botonPrincipal = `${boton} bg-tinta text-papel`
const botonSecundario = `${boton} flex items-center justify-center border border-tinta/25 text-tinta`
const botonFichero = `${botonSecundario} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta`

/** Lo que aún no sabe Percha sin IA: va vacío o en el término medio, y se edita después. */
function prendaManual(categoria: Categoria, fotos: FotoNueva[]): DatosPrenda {
  return {
    fotos: fotos.flatMap(({ original, estado, usarOriginal }) =>
      original
        ? [
            {
              original,
              recortada: estado.fase === 'recortada' && !usarOriginal ? estado.recortada : null,
            },
          ]
        : [],
    ),
    categoria,
    subcategoria: '',
    colores: [],
    estampado: '',
    estilos: [],
    abrigo: 3,
    formalidad: 3,
    ocasiones: [],
    temporadas: [],
    notas: '',
    etiquetadaPor: 'manual',
  }
}

function estaLista(foto: FotoNueva): boolean {
  return (
    foto.original !== null &&
    (foto.usarOriginal || foto.estado.fase === 'recortada' || foto.estado.fase === 'fallida')
  )
}

export function NuevaPrenda({
  recortar = recortarPorDefecto,
  normalizar = normalizarFoto,
  guardar = crearPrenda,
}: Props) {
  const [fotos, setFotos] = useState<FotoNueva[]>([])
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardada, setGuardada] = useState(false)
  const siguienteId = useRef(1)
  // Fotos que siguen en pantalla: lo que llegue tarde de una foto quitada (o de una pantalla cerrada)
  // se descarta sin crear URLs que nadie liberaría.
  const vivas = useRef(new Set<number>())
  const urls = useRef(new Map<number, string[]>())

  useEffect(() => {
    const vivasAhora = vivas.current
    const urlsAhora = urls.current
    return () => {
      vivasAhora.clear()
      for (const deFoto of urlsAhora.values()) {
        for (const url of deFoto) URL.revokeObjectURL(url)
      }
      urlsAhora.clear()
    }
  }, [])

  function crearUrl(id: number, blob: Blob): string {
    const url = URL.createObjectURL(blob)
    urls.current.set(id, [...(urls.current.get(id) ?? []), url])
    return url
  }

  function cambiarFoto(id: number, cambio: Partial<FotoNueva>) {
    setFotos((actuales) => actuales.map((foto) => (foto.id === id ? { ...foto, ...cambio } : foto)))
  }

  function cambiarEstado(id: number, estado: EstadoFoto) {
    cambiarFoto(id, { estado })
  }

  async function recortarFoto(id: number, original: Blob) {
    cambiarEstado(id, { fase: 'recortando', progreso: null })
    try {
      const recortada = await recortar(original, {
        alProgresar: (progreso) => {
          if (vivas.current.has(id)) cambiarEstado(id, { fase: 'recortando', progreso })
        },
      })
      if (!vivas.current.has(id)) return
      cambiarEstado(id, { fase: 'recortada', recortada, urlRecortada: crearUrl(id, recortada) })
    } catch (error) {
      console.error(error)
      if (vivas.current.has(id)) cambiarEstado(id, { fase: 'fallida' })
    }
  }

  async function añadirFoto(fichero: File) {
    const id = siguienteId.current++
    vivas.current.add(id)
    setFotos((actuales) => [
      ...actuales,
      {
        id,
        original: null,
        urlOriginal: null,
        estado: { fase: 'preparando' },
        usarOriginal: false,
      },
    ])
    let original: Blob
    try {
      original = await normalizar(fichero)
    } catch (error) {
      if (!(error instanceof ErrorFoto)) console.error(error)
      quitarFoto(id)
      setAviso(error instanceof ErrorFoto ? error.message : 'No se pudo abrir la foto.')
      return
    }
    if (!vivas.current.has(id)) return
    cambiarFoto(id, { original, urlOriginal: crearUrl(id, original) })
    await recortarFoto(id, original)
  }

  function elegirFicheros(evento: ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(evento.target.files ?? [])
    // Para poder volver a elegir el mismo fichero después de quitarlo.
    evento.target.value = ''
    setAviso(null)
    const huecos = MAX_FOTOS - fotos.length
    if (elegidos.length > huecos) setAviso(`Como mucho ${String(MAX_FOTOS)} fotos por prenda.`)
    for (const fichero of elegidos.slice(0, Math.max(0, huecos))) void añadirFoto(fichero)
  }

  function quitarFoto(id: number) {
    vivas.current.delete(id)
    for (const url of urls.current.get(id) ?? []) URL.revokeObjectURL(url)
    urls.current.delete(id)
    setFotos((actuales) => actuales.filter((foto) => foto.id !== id))
  }

  function empezarOtra() {
    for (const { id } of fotos) quitarFoto(id)
    setCategoria(null)
    setAviso(null)
    setGuardada(false)
  }

  async function guardarPrenda() {
    if (!categoria) return
    setGuardando(true)
    setAviso(null)
    try {
      await guardar(prendaManual(categoria, fotos))
      setGuardada(true)
    } catch (error) {
      console.error(error)
      setAviso('No se pudo guardar la prenda. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  if (guardada) {
    return (
      <Pantalla titulo="Nueva prenda">
        <p role="status" className="text-lg">
          Prenda guardada en el armario.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={botonPrincipal} onClick={empezarOtra}>
            Añadir otra
          </button>
          <Link to="/" className={botonSecundario}>
            Ir al armario
          </Link>
        </div>
      </Pantalla>
    )
  }

  const pendientes = fotos.filter((foto) => !estaLista(foto)).length
  const puedeGuardar = fotos.length > 0 && pendientes === 0 && categoria !== null && !guardando
  let pista: string | null = null
  if (fotos.length === 0) pista = 'Añade al menos una foto.'
  else if (categoria === null) pista = 'Elige la categoría.'
  else if (pendientes > 0) pista = 'Espera a que termine el recorte o marca «Usar la original».'

  return (
    <Pantalla titulo="Nueva prenda">
      <section aria-labelledby="titulo-fotos" className="flex flex-col gap-3">
        <h2 id="titulo-fotos" className="text-lg font-semibold">
          Fotos
        </h2>
        <p className="text-sm text-suave">
          Una o dos fotos de la misma prenda, sola y con buena luz.
        </p>
        <ul className="grid grid-cols-2 gap-3">
          {fotos.map((foto, indice) => (
            <TarjetaFoto
              key={foto.id}
              foto={foto}
              numero={indice + 1}
              onUsarOriginal={(usarOriginal) => {
                cambiarFoto(foto.id, { usarOriginal })
              }}
              onReintentar={() => {
                if (foto.original) void recortarFoto(foto.id, foto.original)
              }}
              onQuitar={() => {
                quitarFoto(foto.id)
              }}
            />
          ))}
          {fotos.length < MAX_FOTOS && (
            <li className="flex aspect-square flex-col justify-center gap-2 rounded-xl border border-dashed border-tinta/30 p-3">
              <p className="text-center text-sm text-suave">
                {fotos.length === 0 ? 'Añade una foto' : 'Otra foto (opcional)'}
              </p>
              <label className={botonFichero}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={elegirFicheros}
                />
                Cámara
              </label>
              <label className={botonFichero}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={elegirFicheros}
                />
                Galería
              </label>
            </li>
          )}
        </ul>
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">Categoría</legend>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIAS.map((opcion) => (
            <label
              key={opcion}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-tinta/25 px-3 text-center has-checked:border-tinta has-checked:bg-tinta has-checked:text-papel has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-tinta"
            >
              <input
                type="radio"
                name="categoria"
                value={opcion}
                className="sr-only"
                checked={categoria === opcion}
                onChange={() => {
                  setCategoria(opcion)
                }}
              />
              {NOMBRES_CATEGORIA[opcion]}
            </label>
          ))}
        </div>
      </fieldset>

      {aviso && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {aviso}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/" className={botonSecundario}>
            Cancelar
          </Link>
          <button
            type="button"
            className={botonPrincipal}
            disabled={!puedeGuardar}
            onClick={() => void guardarPrenda()}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {pista && <p className="text-sm text-suave">{pista}</p>}
      </div>
    </Pantalla>
  )
}
