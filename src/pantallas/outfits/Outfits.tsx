import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Link } from 'react-router'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import { TiempoHoy } from '../../componentes/TiempoHoy.tsx'
import {
  ESTILOS,
  OCASIONES,
  type Estilo,
  type Ocasion,
  type Perfil,
  type Prenda,
} from '../../datos/modelo.ts'
import {
  guardarOutfit,
  guardarPrueba as guardarPruebaOutfit,
  leerPerfil as leerPerfilGuardado,
  listarPrendas,
  marcarFavorito,
} from '../../datos/repositorio.ts'
import { crearCollage } from '../../outfits/collage/index.ts'
import type { PerfilReglas } from '../../outfits/reglas/index.ts'
import type { TiempoHoy as DatosTiempo } from '../../tiempo/index.ts'
import { fechaLocal } from './fecha.ts'
import { crearAlmacenEleccionLocal, type AlmacenEleccion, type Eleccion } from './eleccion.ts'
import { Resultado, type AccionesResultado } from './Resultado.tsx'
import { outfitsPorReglas, type ResultadoSelector, type SelectorOutfits } from './selector.ts'

/** Todo se puede cambiar en los tests; si se pasan funciones, que no cambien en cada render. */
interface Props extends Partial<AccionesResultado> {
  /** Quién elige los outfits: por defecto las reglas; la app pasa `outfitsConIAoReglas`. */
  elegir?: SelectorOutfits
  listar?: () => Promise<Prenda[]>
  /** El perfil, para que los outfits tengan en cuenta el cuerpo, la oficina y si es friolero. */
  leerPerfil?: () => Promise<Perfil>
  almacenEleccion?: AlmacenEleccion
  propsTiempo?: Omit<ComponentProps<typeof TiempoHoy>, 'alCambiar'>
  hoy?: () => Date
}

interface Listo {
  fase: 'listo'
  tanda: number
  resultado: ResultadoSelector
  armarioVacio: boolean
}

/** Mientras se genera se guarda la tanda anterior: si se cancela, vuelve tal cual (con lo guardado). */
type Estado =
  | { fase: 'inicio' }
  | { fase: 'generando'; conIA: boolean; anterior: Listo | null }
  | { fase: 'error' }
  | Listo

const almacenPorDefecto = crearAlmacenEleccionLocal()
const compartidorPorDefecto = typeof navigator === 'undefined' ? {} : navigator

/** Solo lo que miran las reglas; si el perfil no se puede leer, los outfits salen igual, sin él. */
async function leerPerfilSinFallar(leer: () => Promise<Perfil>): Promise<PerfilReglas | null> {
  try {
    const { cuerpo, oficina, sensacionTermica } = await leer()
    return {
      ...(cuerpo && { cuerpo }),
      ...(oficina && { oficina }),
      ...(sensacionTermica && { sensacionTermica }),
    }
  } catch (fallo) {
    console.warn('No se pudo leer el perfil para los outfits', fallo)
    return null
  }
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1)
}

export function Outfits({
  elegir = outfitsPorReglas,
  listar = listarPrendas,
  leerPerfil = leerPerfilGuardado,
  almacenEleccion = almacenPorDefecto,
  propsTiempo,
  hoy = () => new Date(),
  componer = crearCollage,
  guardar = guardarOutfit,
  marcar = marcarFavorito,
  guardarPrueba = guardarPruebaOutfit,
  compartidor = compartidorPorDefecto,
}: Props) {
  const [eleccion, setEleccion] = useState<Eleccion>(() => almacenEleccion.leer())
  const [tiempo, setTiempo] = useState<DatosTiempo | null>(null)
  const [estado, setEstado] = useState<Estado>({ fase: 'inicio' })
  const [guardando, setGuardando] = useState(false)
  const intentos = useRef(0)
  const controlador = useRef<AbortController | null>(null)

  // Salir de la pantalla cancela la petición a Gemini: no gasta cupo en una respuesta que nadie verá.
  useEffect(() => () => controlador.current?.abort(), [])

  function elegirValor(cambio: Partial<Eleccion>) {
    const nueva = { ...eleccion, ...cambio }
    setEleccion(nueva)
    almacenEleccion.guardar(nueva)
  }

  async function generar() {
    controlador.current?.abort()
    const actual = new AbortController()
    controlador.current = actual
    const { signal } = actual
    // Cada pulsación es otra semilla para las reglas y para Gemini: así «Generar otros» da otra tanda.
    const intento = ++intentos.current
    setEstado((antes) => ({
      fase: 'generando',
      conIA: false,
      anterior: antes.fase === 'listo' ? antes : antes.fase === 'generando' ? antes.anterior : null,
    }))
    try {
      const [prendas, perfil] = await Promise.all([listar(), leerPerfilSinFallar(leerPerfil)])
      const fecha = tiempo?.fecha ?? fechaLocal(hoy())
      const peticion = { prendas, ...eleccion, tiempo, fecha, ...(perfil && { perfil }) }
      const resultado = await elegir(peticion, intento, {
        signal,
        alPreguntarIA: () => {
          if (signal.aborted) return
          setEstado((antes) => (antes.fase === 'generando' ? { ...antes, conIA: true } : antes))
        },
      })
      if (signal.aborted) return
      setEstado({ fase: 'listo', tanda: intento, resultado, armarioVacio: prendas.length === 0 })
    } catch (fallo) {
      if (signal.aborted) return
      console.error(fallo)
      setEstado({ fase: 'error' })
    }
  }

  function cancelar() {
    controlador.current?.abort()
    setEstado((antes) =>
      antes.fase === 'generando' ? (antes.anterior ?? { fase: 'inicio' }) : antes,
    )
  }

  const generando = estado.fase === 'generando'
  const listo = estado.fase === 'listo' ? estado : null
  // Durante la espera, la tanda anterior sigue montada (oculta) para no perder lo guardado si se cancela.
  const mostrado = estado.fase === 'generando' ? estado.anterior : listo
  const conIA = estado.fase === 'generando' && estado.conIA

  return (
    <Pantalla titulo="Outfits">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-suave">Estilo</span>
          <select
            value={eleccion.estilo}
            onChange={(e) => {
              elegirValor({ estilo: e.target.value as Estilo })
            }}
            className="min-h-11 w-full rounded-xl border border-tinta/20 bg-white px-3"
          >
            {ESTILOS.map((estilo) => (
              <option key={estilo} value={estilo}>
                {conMayuscula(estilo)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-suave">Ocasión</span>
          <select
            value={eleccion.ocasion}
            onChange={(e) => {
              elegirValor({ ocasion: e.target.value as Ocasion })
            }}
            className="min-h-11 w-full rounded-xl border border-tinta/20 bg-white px-3"
          >
            {OCASIONES.map((ocasion) => (
              <option key={ocasion} value={ocasion}>
                {conMayuscula(ocasion)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TiempoHoy {...propsTiempo} alCambiar={setTiempo} />

      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void generar()}
            disabled={generando || guardando}
            className="min-h-12 min-w-0 flex-1 rounded-xl bg-oliva px-4 text-lg font-semibold text-papel disabled:opacity-60"
          >
            {conIA
              ? 'Gemini está eligiendo…'
              : generando
                ? 'Generando…'
                : listo?.resultado.outfits.length
                  ? 'Generar otros'
                  : 'Generar'}
          </button>
          {conIA && (
            <button
              type="button"
              onClick={cancelar}
              className="min-h-12 shrink-0 rounded-xl border border-tinta px-4 font-medium"
            >
              Cancelar
            </button>
          )}
        </div>
        {!tiempo && (
          <p className="text-sm text-suave">
            Sin el tiempo de hoy, los outfits no tienen en cuenta la temperatura ni la lluvia.
          </p>
        )}
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {estado.fase === 'error' && (
          <p role="alert">No se han podido generar los outfits. Prueba otra vez.</p>
        )}
        {listo?.resultado.avisoIA && (
          <p className="rounded-2xl bg-white shadow-tarjeta p-4">
            {conMayuscula(listo.resultado.avisoIA)}
          </p>
        )}
        {listo && <Avisos avisos={listo.resultado.avisos} armarioVacio={listo.armarioVacio} />}
      </div>

      {mostrado && mostrado.resultado.outfits.length > 0 && (
        <div hidden={generando}>
          <Resultado
            key={mostrado.tanda}
            resultado={mostrado.resultado}
            nombreFichero={`percha-outfits-${fechaLocal(hoy())}.jpg`}
            componer={componer}
            guardar={guardar}
            marcar={marcar}
            guardarPrueba={guardarPrueba}
            compartidor={compartidor}
            alOcupar={setGuardando}
          />
        </div>
      )}
    </Pantalla>
  )
}

function Avisos({ avisos, armarioVacio }: { avisos: string[]; armarioVacio: boolean }) {
  if (!armarioVacio && avisos.length === 0) return null
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white shadow-tarjeta p-4">
      {armarioVacio ? (
        <p>Tu armario está vacío: añade prendas para que Percha te proponga outfits.</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {avisos.map((aviso) => (
            <li key={aviso}>{conMayuscula(aviso)}.</li>
          ))}
        </ul>
      )}
      <Link to="/prendas/nueva" className="self-start font-medium underline underline-offset-2">
        Añadir prenda
      </Link>
    </div>
  )
}
