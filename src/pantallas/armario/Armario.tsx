import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import type { Prenda } from '../../datos/modelo.ts'
import { borrarPrenda, listarPrendas, type FiltrosPrendas } from '../../datos/repositorio.ts'
import { aFiltrosPrendas, contar, hayFiltros, SIN_FILTROS, type Filtros } from './ayudas.ts'
import { DetallePrenda } from './DetallePrenda.tsx'
import { FiltrosArmario } from './FiltrosArmario.tsx'
import { RejillaPrendas } from './RejillaPrendas.tsx'

interface Props {
  listar?: (filtros?: FiltrosPrendas) => Promise<Prenda[]>
  borrar?: (id: string) => Promise<void>
}

/** El detalle va en la URL (`/?prenda=<id>`) para que el botón «atrás» del móvil lo cierre. */
const PARAMETRO_PRENDA = 'prenda'

export function Armario({ listar = listarPrendas, borrar = borrarPrenda }: Props) {
  const [todas, setTodas] = useState<Prenda[] | null>(null)
  // Solo los ids: las fotos salen siempre de `todas`, así filtrar no recrea sus URLs.
  const [idsFiltrados, setIdsFiltrados] = useState<Set<string> | null>(null)
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [error, setError] = useState(false)
  const [borrada, setBorrada] = useState<string | null>(null)
  const [parametros, setParametros] = useSearchParams()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const idDetalle = parametros.get(PARAMETRO_PRENDA)
  const filtrando = hayFiltros(filtros)

  useEffect(() => {
    let vigente = true
    listar().then(
      (prendas) => {
        if (vigente) setTodas(prendas)
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
        if (vigente) setIdsFiltrados(new Set(prendas.map((p) => p.id)))
      },
      (fallo: unknown) => {
        console.error(fallo)
        if (vigente) setError(true)
      },
    )
    return () => {
      vigente = false
    }
  }, [listar, filtros, filtrando])

  // Mientras llega la consulta de unos filtros nuevos se queda el resultado anterior, sin parpadeo.
  const visibles =
    filtrando && idsFiltrados ? (todas?.filter((p) => idsFiltrados.has(p.id)) ?? null) : todas

  function abrir(prenda: Prenda) {
    setBorrada(null)
    setParametros({ [PARAMETRO_PRENDA]: prenda.id }, { state: { desdeLista: true } })
  }

  function cerrar() {
    const estado: unknown = ubicacion.state
    const desdeLista =
      typeof estado === 'object' && estado !== null && 'desdeLista' in estado && estado.desdeLista
    if (desdeLista) void navegar(-1)
    else setParametros({}, { replace: true })
  }

  async function borrarDetalle(id: string) {
    await borrar(id)
    setBorrada(id)
    setTodas((actuales) => actuales?.filter((p) => p.id !== id) ?? null)
    cerrar()
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
        </div>
      )}

      {todas && todas.length > 0 && (
        <>
          <FiltrosArmario prendas={todas} filtros={filtros} onCambiar={setFiltros} />

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
                  setFiltros(SIN_FILTROS)
                }}
              >
                Quitar filtros
              </button>
            </div>
          )}

          {visibles && visibles.length > 0 && <RejillaPrendas prendas={visibles} onAbrir={abrir} />}
        </>
      )}

      {/* T1.5: pasa `onEditar` a DetallePrenda para abrir el formulario de T1.3 desde aquí. */}
      {todas && idDetalle !== null && idDetalle !== borrada && (
        <DetallePrenda prenda={prendaDetalle} onVolver={cerrar} onBorrar={borrarDetalle} />
      )}
    </Pantalla>
  )
}
