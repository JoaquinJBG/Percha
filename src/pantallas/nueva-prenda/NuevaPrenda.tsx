import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  AvisoEtiquetado,
  BASE_VACIA,
  etiquetadaPor,
  fotosParaIA,
  proveedorConClave,
  useEtiquetadoIA,
  type AvisoIA,
  type BaseEtiquetas,
  type ObtenerProveedor,
} from '../../componentes/etiquetado-ia/index.ts'
import { FormularioPrenda } from '../../componentes/formulario-prenda/index.ts'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import type { NuevaPrenda as DatosPrenda, EtiquetasPrenda, FotoPrenda } from '../../datos/modelo.ts'
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
  obtenerProveedor?: ObtenerProveedor
}

type Paso = 'fotos' | 'etiquetando' | 'revisar'

const MAX_FOTOS = 2

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta'
const botonPrincipal = `${boton} bg-tinta text-papel`
const botonSecundario = `${boton} flex items-center justify-center border border-tinta/25 text-tinta`
const botonFichero = `${botonSecundario} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta`
const titulo = 'text-lg font-semibold outline-none'

const AVISO_SIN_CLAVE_AL_EMPEZAR: AvisoIA = {
  titulo: 'Sin clave de Gemini',
  texto: 'Tendrás que poner las etiquetas a mano. Con tu clave en Ajustes, lo hace la IA.',
  ajustes: true,
  reintentar: false,
}

function fotosDePrenda(fotos: FotoNueva[]): FotoPrenda[] {
  return fotos.flatMap(({ original, estado, usarOriginal }) =>
    original
      ? [
          {
            original,
            recortada: estado.fase === 'recortada' && !usarOriginal ? estado.recortada : null,
          },
        ]
      : [],
  )
}

function urlDeFoto({ estado, usarOriginal, urlOriginal }: FotoNueva): string | null {
  return estado.fase === 'recortada' && !usarOriginal ? estado.urlRecortada : urlOriginal
}

function mismasFotos(a: Blob[], b: Blob[]): boolean {
  return a.length === b.length && a.every((foto, i) => foto === b[i])
}

function estaLista(foto: FotoNueva): boolean {
  return (
    foto.original !== null &&
    (foto.usarOriginal || foto.estado.fase === 'recortada' || foto.estado.fase === 'fallida')
  )
}

function Miniaturas({ fotos }: { fotos: FotoNueva[] }) {
  return (
    <div className="flex gap-2">
      {fotos.map((foto, i) => {
        const url = urlDeFoto(foto)
        return url ? (
          <img
            key={foto.id}
            src={url}
            alt={`Foto ${String(i + 1)}`}
            className="size-24 rounded-xl border border-tinta/15 bg-white object-contain"
          />
        ) : null
      })}
    </div>
  )
}

export function NuevaPrenda({
  recortar = recortarPorDefecto,
  normalizar = normalizarFoto,
  guardar = crearPrenda,
  obtenerProveedor = proveedorConClave,
}: Props) {
  const [fotos, setFotos] = useState<FotoNueva[]>([])
  const [paso, setPaso] = useState<Paso>('fotos')
  const [aviso, setAviso] = useState<string | null>(null)
  const [sinClave, setSinClave] = useState(false)
  // Con qué empieza el formulario; `versionFormulario` lo vuelve a montar con esos valores.
  const [base, setBase] = useState<BaseEtiquetas | null>(null)
  const [avisoIA, setAvisoIA] = useState<AvisoIA | null>(null)
  const [versionFormulario, setVersionFormulario] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [guardada, setGuardada] = useState(false)
  const ia = useEtiquetadoIA(obtenerProveedor)
  const navegar = useNavigate()
  const siguienteId = useRef(1)
  // Fotos que siguen en pantalla: lo que llegue tarde de una foto quitada (o de una pantalla cerrada)
  // se descarta sin crear URLs que nadie liberaría.
  const vivas = useRef(new Set<number>())
  const urls = useRef(new Map<number, string[]>())
  // Para no gastar otra petición si se vuelve a las fotos y se sigue sin cambiarlas.
  const etiquetadasPara = useRef<Blob[] | null>(null)
  const tituloPaso = useRef<HTMLHeadingElement>(null)
  const pasoAnterior = useRef(paso)

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

  useEffect(() => {
    let vigente = true
    obtenerProveedor().then(
      (proveedor) => {
        if (vigente) setSinClave(proveedor === null)
      },
      (error: unknown) => {
        console.error(error)
      },
    )
    return () => {
      vigente = false
    }
  }, [obtenerProveedor])

  // Al cambiar de paso, el foco (y la vista) van a su título.
  useEffect(() => {
    if (pasoAnterior.current === paso) return
    pasoAnterior.current = paso
    tituloPaso.current?.focus()
  }, [paso])

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

  function abrirFormulario(nueva: BaseEtiquetas, avisoNuevo: AvisoIA | null) {
    setBase(nueva)
    setAvisoIA(avisoNuevo)
    setVersionFormulario((version) => version + 1)
    setPaso('revisar')
  }

  async function etiquetar(conFotos: Blob[]) {
    setAviso(null)
    setPaso('etiquetando')
    const resultado = await ia.etiquetar(conFotos)
    if (!resultado) return
    // Tras un fallo, «Siguiente» con las mismas fotos vuelve a probar.
    etiquetadasPara.current = 'etiquetas' in resultado ? conFotos : null
    if ('etiquetas' in resultado)
      abrirFormulario({ etiquetas: resultado.etiquetas, por: 'ia' }, null)
    else abrirFormulario(BASE_VACIA, resultado.aviso)
  }

  function siguiente() {
    const paraIA = fotosParaIA(fotosDePrenda(fotos))
    if (base && etiquetadasPara.current && mismasFotos(etiquetadasPara.current, paraIA)) {
      setPaso('revisar')
      return
    }
    void etiquetar(paraIA)
  }

  function etiquetarAMano() {
    ia.cancelar()
    etiquetadasPara.current = null
    abrirFormulario(BASE_VACIA, null)
  }

  function empezarOtra() {
    for (const { id } of fotos) quitarFoto(id)
    etiquetadasPara.current = null
    setBase(null)
    setAvisoIA(null)
    setAviso(null)
    setPaso('fotos')
    setGuardada(false)
  }

  async function guardarPrenda(etiquetas: EtiquetasPrenda) {
    if (!base) return
    setGuardando(true)
    setAviso(null)
    try {
      await guardar({
        fotos: fotosDePrenda(fotos),
        ...etiquetas,
        etiquetadaPor: etiquetadaPor(base, etiquetas),
      })
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
  const puedeSeguir = fotos.length > 0 && pendientes === 0
  let pista: string | null = null
  if (fotos.length === 0) pista = 'Añade al menos una foto.'
  else if (pendientes > 0) pista = 'Espera a que termine el recorte o marca «Usar la original».'

  const alerta = aviso && (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
      {aviso}
    </p>
  )

  return (
    <Pantalla titulo="Nueva prenda">
      {paso === 'fotos' && (
        <>
          {sinClave && (
            <AvisoEtiquetado
              aviso={{ ...AVISO_SIN_CLAVE_AL_EMPEZAR, ajustes: fotos.length === 0 }}
              discreto
            />
          )}

          <section aria-labelledby="titulo-fotos" className="flex flex-col gap-3">
            <h2 id="titulo-fotos" ref={tituloPaso} tabIndex={-1} className={titulo}>
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

          {alerta}

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <Link to="/" className={botonSecundario}>
                Cancelar
              </Link>
              <button
                type="button"
                className={botonPrincipal}
                disabled={!puedeSeguir}
                onClick={siguiente}
              >
                Siguiente
              </button>
            </div>
            {pista && <p className="text-sm text-suave">{pista}</p>}
          </div>
        </>
      )}

      {paso === 'etiquetando' && (
        <section aria-labelledby="titulo-etiquetando" className="flex flex-col gap-4">
          <h2 id="titulo-etiquetando" ref={tituloPaso} tabIndex={-1} className={titulo}>
            Etiquetando con IA
          </h2>
          <Miniaturas fotos={fotos} />
          <div role="status" className="flex flex-col gap-1">
            <p>Gemini está mirando la prenda…</p>
            <p className="text-sm text-suave">Suele tardar unos segundos.</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-tinta/10">
            <div className="h-full w-1/3 animate-pulse bg-tinta" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={botonSecundario}
              onClick={() => {
                ia.cancelar()
                setPaso('fotos')
              }}
            >
              Cambiar fotos
            </button>
            <button type="button" className={botonSecundario} onClick={etiquetarAMano}>
              Etiquetar a mano
            </button>
          </div>
        </section>
      )}

      {/* Montado aunque se vuelva a las fotos, para no perder lo que ya se ha cambiado. */}
      {base && (
        <section
          aria-labelledby="titulo-etiquetas"
          hidden={paso !== 'revisar'}
          className="flex flex-col gap-4"
        >
          <button
            type="button"
            className="-ml-2 flex min-h-12 items-center gap-1 self-start rounded-xl px-2 font-medium focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-50"
            disabled={guardando}
            onClick={() => {
              setAviso(null)
              setPaso('fotos')
            }}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 5-7 7 7 7" />
            </svg>
            Cambiar fotos
          </button>
          <h2
            id="titulo-etiquetas"
            ref={paso === 'revisar' ? tituloPaso : undefined}
            tabIndex={-1}
            className={titulo}
          >
            {base.por === 'ia' ? 'Revisa las etiquetas' : 'Etiquetas'}
          </h2>
          <Miniaturas fotos={fotos} />
          {base.por === 'ia' && (
            <p className="text-sm text-suave">
              Las ha puesto la IA. Cambia lo que no cuadre y guarda.
            </p>
          )}
          {avisoIA && (
            <AvisoEtiquetado
              aviso={avisoIA}
              onReintentar={() => {
                void etiquetar(fotosParaIA(fotosDePrenda(fotos)))
              }}
              nota={
                avisoIA.ajustes
                  ? 'Rellena las etiquetas a mano. Si vas ahora a Ajustes, esta prenda no se guarda: mejor guárdala y vuelve a etiquetarla desde Editar.'
                  : 'Rellena las etiquetas a mano o prueba otra vez.'
              }
            />
          )}
          {alerta}
          <FormularioPrenda
            key={versionFormulario}
            iniciales={base.etiquetas}
            ocupado={guardando}
            textoGuardar={guardando ? 'Guardando…' : 'Guardar'}
            alGuardar={(etiquetas) => void guardarPrenda(etiquetas)}
            alCancelar={() => void navegar('/')}
          />
        </section>
      )}
    </Pantalla>
  )
}
