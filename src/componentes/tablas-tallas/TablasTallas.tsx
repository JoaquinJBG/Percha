import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  idTablaTallas,
  MEDIDAS_TALLA,
  type Cuerpo,
  type DatosTablaTallas,
  type TablaTallas,
  type TipoTalla,
} from '../../datos/modelo.ts'
import {
  borrarTablaTallas,
  guardarTablaTallas,
  leerPerfil,
  listarTablasTallas,
} from '../../datos/repositorio.ts'
import type { PrendaAjuste } from '../../datos/ajuste.ts'
import {
  AvisoEtiquetado,
  avisoDeError,
  proveedorConClave,
  type AvisoIA,
  type ObtenerProveedor,
} from '../etiquetado-ia/index.ts'
import { AjusteTalla } from './AjusteTalla.tsx'
import { EditorTablaTallas } from './EditorTablaTallas.tsx'
import { NOMBRE_MEDIDA } from './tablas.ts'

interface Props {
  /** Solo la de esta marca y tipo (detalle de una prenda); sin él, todas (Perfil). */
  de?: { marca: string; tipo: TipoTalla }
  /** La prenda del detalle, para decir cómo le queda su talla (T10.2). */
  prenda?: PrendaAjuste & { talla?: string | undefined }
  /** Las medidas del perfil. Sin la prop, se leen del perfil; `null`, que no hay. */
  cuerpo?: Cuerpo | null
  leerCuerpo?: () => Promise<Cuerpo | undefined>
  listar?: () => Promise<TablaTallas[]>
  guardar?: (datos: DatosTablaTallas, anterior?: string) => Promise<TablaTallas>
  borrar?: (id: string) => Promise<void>
  obtenerProveedor?: ObtenerProveedor
}

interface Edicion {
  inicial: Partial<DatosTablaTallas>
  /** Ya había otra tabla de esa marca y tipo: se espera a que diga si la sustituye. */
  pisar?: DatosTablaTallas | undefined
  /** El `id` de la tabla que se edita, para quitarla si cambia la marca o el tipo. */
  anterior?: string
}

const SIN_CLAVE: AvisoIA = {
  titulo: 'Falta la clave de Gemini',
  texto: 'Para leer la tabla con la IA, ponla en Ajustes. También puedes escribirla a mano.',
  ajustes: true,
  reintentar: false,
}

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonSecundario = `${boton} border border-tinta/25 text-tinta`
const botonTexto = 'min-h-11 px-2 text-sm font-medium text-oliva underline underline-offset-2'

function nombreTabla({ marca, tipo }: { marca: string; tipo: TipoTalla }): string {
  return `${marca} · ${tipo}`
}

function mismaMarcaYTipo(tabla: TablaTallas, de: { marca: string; tipo: TipoTalla }): boolean {
  return (
    tabla.tipo === de.tipo &&
    tabla.marca.trim().toLocaleLowerCase('es') === de.marca.trim().toLocaleLowerCase('es')
  )
}

function VistaTabla({ tabla }: { tabla: TablaTallas }) {
  const columnas = MEDIDAS_TALLA.filter((m) => tabla.filas.some((f) => f[m] !== undefined))
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="text-sm">
        <caption className="sr-only">
          {nombreTabla(tabla)}, medidas{' '}
          {tabla.medidaDe === 'cuerpo' ? 'del cuerpo' : 'de la prenda'} en cm
        </caption>
        <thead>
          <tr className="text-left text-suave">
            <th scope="col" className="py-1 pr-3 font-medium">
              Talla
            </th>
            {columnas.map((m) => (
              <th key={m} scope="col" className="py-1 pr-3 font-medium">
                {NOMBRE_MEDIDA[m]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((fila) => (
            <tr key={fila.talla} className="border-t border-tinta/10">
              <th scope="row" className="py-1 pr-3 text-left font-medium">
                {fila.talla}
              </th>
              {columnas.map((m) => (
                <td key={m} className="py-1 pr-3">
                  {fila[m] === undefined ? '—' : String(fila[m]).replace('.', ',')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Tablas de tallas (T10.1, D22): leerlas de una captura de la guía de la tienda, verlas, editarlas y
 * borrarlas. Percha no descarga nada de la tienda: la captura la hace el usuario.
 */
async function cuerpoDelPerfil(): Promise<Cuerpo | undefined> {
  return (await leerPerfil()).cuerpo
}

export function TablasTallas({
  de,
  prenda,
  cuerpo,
  leerCuerpo = cuerpoDelPerfil,
  listar = listarTablasTallas,
  guardar = guardarTablaTallas,
  borrar = borrarTablaTallas,
  obtenerProveedor = proveedorConClave,
}: Props) {
  const [tablas, setTablas] = useState<TablaTallas[] | null>(null)
  const [cuerpoLeido, setCuerpoLeido] = useState<Cuerpo | undefined>(undefined)
  const [errorLectura, setErrorLectura] = useState(false)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [avisoIA, setAvisoIA] = useState<AvisoIA | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const selector = useRef<HTMLInputElement>(null)

  async function cargar() {
    try {
      setTablas(await listar())
      setErrorLectura(false)
    } catch {
      setErrorLectura(true)
    }
  }

  useEffect(() => {
    let vigente = true
    listar().then(
      (leidas) => {
        if (vigente) setTablas(leidas)
      },
      () => {
        if (vigente) setErrorLectura(true)
      },
    )
    return () => {
      vigente = false
    }
  }, [listar])

  // Perfil pasa las medidas que tiene en pantalla; el detalle de la prenda las lee del perfil.
  const leerDelPerfil = cuerpo === undefined
  useEffect(() => {
    if (!leerDelPerfil) return
    let vigente = true
    leerCuerpo().then(
      (leido) => {
        if (vigente) setCuerpoLeido(leido)
      },
      () => {
        // Sin perfil no hay ajuste: la tabla se sigue viendo igual.
      },
    )
    return () => {
      vigente = false
    }
  }, [leerDelPerfil, leerCuerpo])
  const medidas = leerDelPerfil ? cuerpoLeido : (cuerpo ?? undefined)

  const visibles = (tablas ?? []).filter((t) => !de || mismaMarcaYTipo(t, de))
  const deLaPrenda = de ? visibles[0] : undefined

  async function leerFoto(evento: ChangeEvent<HTMLInputElement>) {
    const foto = evento.target.files?.[0]
    evento.target.value = ''
    if (!foto) return
    setAvisoIA(null)
    setMensaje(null)
    setLeyendo(true)
    try {
      const proveedor = await obtenerProveedor()
      if (!proveedor) {
        setAvisoIA(SIN_CLAVE)
        return
      }
      const leida = await proveedor.leerTablaTallas(foto)
      setEdicion({
        inicial: {
          ...leida,
          // En el detalle, la tabla es la de la prenda aunque la captura diga «Zara Man».
          marca: de?.marca ?? leida.marca ?? '',
          tipo: de?.tipo ?? leida.tipo,
        },
        ...(deLaPrenda && { anterior: deLaPrenda.id }),
      })
    } catch (error) {
      setAvisoIA(avisoDeError(error, 'No se ha podido leer la tabla'))
    } finally {
      setLeyendo(false)
    }
  }

  async function guardarEdicion(datos: DatosTablaTallas, confirmado = false) {
    const id = idTablaTallas(datos.marca, datos.tipo)
    const otra = (tablas ?? []).find((t) => t.id === id && t.id !== edicion?.anterior)
    if (otra && !confirmado) {
      setEdicion((anterior) => anterior && { ...anterior, inicial: datos, pisar: datos })
      return
    }
    setOcupado(true)
    try {
      await guardar(datos, edicion?.anterior)
      setEdicion(null)
      setMensaje(`Tabla de ${nombreTabla(datos)} guardada.`)
      await cargar()
    } catch {
      setMensaje('No se ha podido guardar la tabla.')
    } finally {
      setOcupado(false)
    }
  }

  async function borrarTabla(tabla: TablaTallas) {
    setOcupado(true)
    try {
      await borrar(tabla.id)
      setBorrando(null)
      setMensaje(`Tabla de ${nombreTabla(tabla)} borrada.`)
      await cargar()
    } catch {
      setMensaje('No se ha podido borrar la tabla.')
    } finally {
      setOcupado(false)
    }
  }

  if (edicion) {
    const { pisar } = edicion
    if (pisar) {
      return (
        <div role="group" aria-label="Sustituir tabla" className="flex flex-col gap-2">
          <p>Ya tienes una tabla de {nombreTabla(pisar)}. ¿La sustituyes por esta?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`${boton} bg-oliva text-papel`}
              disabled={ocupado}
              onClick={() => void guardarEdicion(pisar, true)}
            >
              Sí, sustituir
            </button>
            <button
              type="button"
              className={botonSecundario}
              disabled={ocupado}
              onClick={() => {
                setEdicion({ ...edicion, pisar: undefined })
              }}
            >
              No, volver
            </button>
          </div>
        </div>
      )
    }
    return (
      <EditorTablaTallas
        // Al volver de «No», el editor se monta otra vez con lo que se había escrito.
        key={JSON.stringify(edicion.inicial)}
        inicial={edicion.inicial}
        ocupado={ocupado}
        alGuardar={(datos) => void guardarEdicion(datos)}
        alCancelar={() => {
          setEdicion(null)
        }}
      />
    )
  }

  const añadir = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={botonSecundario}
        disabled={leyendo}
        onClick={() => selector.current?.click()}
      >
        Añadir desde foto
      </button>
      <button
        type="button"
        className={botonSecundario}
        disabled={leyendo}
        onClick={() => {
          setMensaje(null)
          setEdicion({ inicial: de ?? {} })
        }}
      >
        Escribirla a mano
      </button>
      <input
        ref={selector}
        type="file"
        accept="image/*"
        aria-label="Captura de la guía de tallas"
        className="hidden"
        onChange={(e) => void leerFoto(e)}
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {errorLectura && (
        <p className="text-sm text-suave">No se han podido leer las tablas de tallas.</p>
      )}
      {de && tablas !== null && !deLaPrenda && (
        <p className="text-sm">
          Tabla de tallas de {nombreTabla(de)}: añádela desde una captura de la guía de la tienda.
        </p>
      )}
      {!de && tablas?.length === 0 && (
        <p className="text-sm text-suave">
          Haz una captura de la guía de tallas de una tienda y Percha la pasa a cm.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visibles.map((tabla) => {
          const nombre = de ? `Tabla de tallas de ${nombreTabla(tabla)}` : nombreTabla(tabla)
          return (
            <li
              key={tabla.id}
              className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-tarjeta"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium break-words">{nombre}</p>
                  <p className="text-sm text-suave">
                    Medidas {tabla.medidaDe === 'cuerpo' ? 'del cuerpo' : 'de la prenda'} ·{' '}
                    {tabla.filas.length} {tabla.filas.length === 1 ? 'talla' : 'tallas'}
                  </p>
                </div>
                <button
                  type="button"
                  className={botonTexto}
                  aria-expanded={abierta === tabla.id}
                  onClick={() => {
                    setAbierta(abierta === tabla.id ? null : tabla.id)
                  }}
                >
                  {abierta === tabla.id ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <AjusteTalla
                tabla={tabla}
                cuerpo={medidas}
                enPerfil={!de}
                {...(prenda && { prenda })}
              />
              {abierta === tabla.id && (
                <>
                  <VistaTabla tabla={tabla} />
                  {borrando === tabla.id ? (
                    <div
                      role="group"
                      aria-label="Confirmar borrado"
                      className="flex flex-col gap-2"
                    >
                      <p className="text-sm">¿Borrar la tabla de {nombreTabla(tabla)}?</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`${boton} bg-red-800 text-white`}
                          disabled={ocupado}
                          onClick={() => void borrarTabla(tabla)}
                        >
                          Sí, borrar
                        </button>
                        <button
                          type="button"
                          className={botonSecundario}
                          disabled={ocupado}
                          onClick={() => {
                            setBorrando(null)
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={botonTexto}
                        onClick={() => {
                          setMensaje(null)
                          setEdicion({ inicial: tabla, anterior: tabla.id })
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={botonTexto}
                        onClick={() => {
                          setBorrando(tabla.id)
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>

      {(!de || (tablas !== null && !deLaPrenda)) && añadir}
      {leyendo && (
        <p role="status" className="text-sm">
          Leyendo la tabla…
        </p>
      )}
      {avisoIA && <AvisoEtiquetado aviso={avisoIA} />}
      {mensaje && (
        <p role="status" className="text-sm">
          {mensaje}
        </p>
      )}
    </div>
  )
}
