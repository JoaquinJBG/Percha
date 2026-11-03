import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { proveedorConClave, type ObtenerProveedor } from '../../componentes/etiquetado-ia/index.ts'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import type { CambiosPrenda, Prenda } from '../../datos/modelo.ts'
import {
  actualizarPrenda,
  borrarPrenda,
  listarPrendas,
  type FiltrosPrendas,
} from '../../datos/repositorio.ts'
import { aFiltrosPrendas, contar, hayFiltros, SIN_FILTROS, type Filtros } from './ayudas.ts'
import { DetallePrenda } from './DetallePrenda.tsx'
import { EditarPrenda } from './EditarPrenda.tsx'
import { FiltrosArmario } from './FiltrosArmario.tsx'
import { RejillaPrendas } from './RejillaPrendas.tsx'

/** Las props son para los tests; `listar`, si se pasa, que no cambie en cada render o se recarga sin fin. */
interface Props {
  listar?: (filtros?: FiltrosPrendas) => Promise<Prenda[]>
  borrar?: (id: string) => Promise<void>
  actualizar?: (id: string, cambios: CambiosPrenda) => Promise<Prenda>
  obtenerProveedor?: ObtenerProveedor
}

/**
 * El detalle va en la URL (`/?prenda=<id>`) y la edición también (`&editar=1`), para que el botón
 * «atrás» del móvil los cierre.
 */
const PARAMETRO_PRENDA = 'prenda'
const PARAMETRO_EDITAR = 'editar'

const botonAñadir =
  'flex min-h-12 items-center justify-center gap-2 rounded-xl bg-tinta px-4 font-medium text-papel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta'

function esEstadoCon(estado: unknown, clave: string): boolean {
  return (
    typeof estado === 'object' &&
    estado !== null &&
    clave in estado &&
    Boolean((estado as Record<string, unknown>)[clave])
  )
}

export function Armario({
  listar = listarPrendas,
  borrar = borrarPrenda,
  actualizar = actualizarPrenda,
  obtenerProveedor = proveedorConClave,
}: Props) {
  const [todas, setTodas] = useState<Prenda[] | null>(null)
  // Solo los ids: las fotos salen siempre de `todas`, así las que siguen a la vista no recrean su URL.
  const [idsFiltrados, setIdsFiltrados] = useState<Set<string> | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [error, setError] = useState(false)
  const [borrada, setBorrada] = useState<string | null>(null)
  const [parametros, setParametros] = useSearchParams()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const idDetalle = parametros.get(PARAMETRO_PRENDA)
  const editando = idDetalle !== null && parametros.get(PARAMETRO_EDITAR) === '1'
  const filtrando = hayFiltros(filtros)
  // Qué detalle sigue abierto, para que dos toques en «volver» o un borrado que acaba tarde no
  // retrocedan dos veces y saquen al usuario de la app.
  const detalleAbierto = useRef(idDetalle)
  // Lo mismo para la edición: un doble toque o un «atrás» mientras guarda no cierran dos veces.
  const edicionAbierta = useRef(editando ? idDetalle : null)
  // Sube tras editar una prenda, para que los filtros se vuelvan a aplicar.
  const [ediciones, setEdiciones] = useState(0)

  useEffect(() => {
    detalleAbierto.current = idDetalle
  }, [idDetalle])

  useEffect(() => {
    edicionAbierta.current = editando ? idDetalle : null
  }, [editando, idDetalle])

  useEffect(() => {
    let vigente = true
    listar().then(
      (prendas) => {
        if (!vigente) return
        setTodas(prendas)
        setError(false)
      },
      (fallo: unknown) => {
        console.error(fallo)
        if (vigente) setError(true)
      },
    )
    return () => {
      vigente = false
    }
  }, [listar])

  useEffect(() => {
    if (!filtrando) return
    let vigente = true
    listar(aFiltrosPrendas(filtros)).then(
      (prendas) => {
        if (!vigente) return
        setIdsFiltrados(new Set(prendas.map((p) => p.id)))
        setError(false)
      },
      (fallo: unknown) => {
        console.error(fallo)
        if (vigente) setError(true)
      },
    )
    return () => {
      vigente = false
    }
  }, [listar, filtros, filtrando, ediciones])

  // Mientras llega la consulta de unos filtros nuevos se queda el resultado anterior, sin parpadeo.
  const visibles =
    filtrando && idsFiltrados ? (todas?.filter((p) => idsFiltrados.has(p.id)) ?? null) : todas

  function cambiarFiltros(nuevos: Filtros) {
    setFiltros(nuevos)
    // Para que el siguiente filtro no enseñe un instante el resultado de uno anterior.
    if (!hayFiltros(nuevos)) setIdsFiltrados(null)
  }

  function abrir(prenda: Prenda) {
    setBorrada(null)
    setParametros({ [PARAMETRO_PRENDA]: prenda.id }, { state: { desdeLista: true } })
  }

  function cerrar(id: string) {
    if (detalleAbierto.current !== id) return
    detalleAbierto.current = null
    if (esEstadoCon(ubicacion.state, 'desdeLista')) void navegar(-1)
    else setParametros({}, { replace: true })
  }

  function editar(prenda: Prenda) {
    setParametros(
      { [PARAMETRO_PRENDA]: prenda.id, [PARAMETRO_EDITAR]: '1' },
      { state: { desdeDetalle: true } },
    )
  }

  function cerrarEdicion(id: string) {
    if (edicionAbierta.current !== id) return
    edicionAbierta.current = null
    if (esEstadoCon(ubicacion.state, 'desdeDetalle')) void navegar(-1)
    else setParametros({ [PARAMETRO_PRENDA]: id }, { replace: true })
  }

  async function guardarEdicion(id: string, cambios: CambiosPrenda) {
    const guardada = await actualizar(id, cambios)
    setTodas((actuales) => actuales?.map((p) => (p.id === id ? guardada : p)) ?? null)
    setEdiciones((anteriores) => anteriores + 1)
    cerrarEdicion(id)
  }

  async function borrarDetalle(id: string) {
    await borrar(id)
    setBorrada(id)
    setTodas((actuales) => actuales?.filter((p) => p.id !== id) ?? null)
    cerrar(id)
  }

  const prendaDetalle = todas?.find((p) => p.id === idDetalle)

  return (
    <Pantalla titulo="Armario">
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800">
          No se pudo leer el armario.
        </p>
      )}

      {todas?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-tinta/25 px-6 py-10 text-center">
          <p className="text-lg font-medium">Tu armario está vacío</p>
          <p className="text-suave">
            Añade tu primera prenda con una foto: Percha la recorta y la etiqueta por ti.
          </p>
          <Link to="/prendas/nueva" className={`${botonAñadir} mt-2`}>
            Añadir prenda
          </Link>
        </div>
      )}

      {todas && todas.length > 0 && (
        <div inert={idDetalle !== null} className="contents">
          <Link to="/prendas/nueva" className={botonAñadir}>
            <span aria-hidden="true" className="text-xl leading-none">
              +
            </span>
            Añadir prenda
          </Link>

          <FiltrosArmario prendas={todas} filtros={filtros} onCambiar={cambiarFiltros} />

          {borrada !== null && (
            <p role="status" className="text-sm">
              Prenda borrada.
            </p>
          )}

          {visibles && (
            <p className="text-sm text-suave" aria-live="polite">
              {filtrando
                ? `${String(visibles.length)} de ${contar(todas.length, 'prenda', 'prendas')}`
                : contar(todas.length, 'prenda', 'prendas')}
            </p>
          )}

          {visibles?.length === 0 && (
            <div className="flex flex-col items-start gap-2">
              <p>Ninguna prenda cumple estos filtros.</p>
              <button
                type="button"
                className="min-h-12 font-medium underline"
                onClick={() => {
                  cambiarFiltros(SIN_FILTROS)
                }}
              >
                Quitar filtros
              </button>
            </div>
          )}

          {visibles && visibles.length > 0 && <RejillaPrendas prendas={visibles} onAbrir={abrir} />}
        </div>
      )}

      {todas && idDetalle !== null && idDetalle !== borrada && editando && prendaDetalle && (
        <EditarPrenda
          // Si cambia la prenda (otro enlace), el formulario empieza de cero.
          key={prendaDetalle.id}
          prenda={prendaDetalle}
          obtenerProveedor={obtenerProveedor}
          onVolver={() => {
            cerrarEdicion(idDetalle)
          }}
          onGuardar={(cambios) => guardarEdicion(idDetalle, cambios)}
        />
      )}

      {todas && idDetalle !== null && idDetalle !== borrada && !(editando && prendaDetalle) && (
        <DetallePrenda
          prenda={prendaDetalle}
          onVolver={() => {
            cerrar(idDetalle)
          }}
          onBorrar={borrarDetalle}
          onEditar={editar}
        />
      )}
    </Pantalla>
  )
}
