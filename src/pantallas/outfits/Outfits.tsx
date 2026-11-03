import { useRef, useState, type ComponentProps } from 'react'
import { Link } from 'react-router'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import { TiempoHoy } from '../../componentes/TiempoHoy.tsx'
import { ESTILOS, OCASIONES, type Estilo, type Ocasion, type Prenda } from '../../datos/modelo.ts'
import { guardarOutfit, listarPrendas, marcarFavorito } from '../../datos/repositorio.ts'
import { crearCollage } from '../../outfits/collage/index.ts'
import type { ResultadoOutfits } from '../../outfits/reglas/index.ts'
import type { TiempoHoy as DatosTiempo } from '../../tiempo/index.ts'
import { fechaLocal } from './fecha.ts'
import { crearAlmacenEleccionLocal, type AlmacenEleccion, type Eleccion } from './eleccion.ts'
import { Resultado, type AccionesResultado } from './Resultado.tsx'
import { outfitsPorReglas, type SelectorOutfits } from './selector.ts'

/** Todo se puede cambiar en los tests; si se pasan funciones, que no cambien en cada render. */
interface Props extends Partial<AccionesResultado> {
  /** Quién elige los outfits: por defecto las reglas; T2.5 pasará aquí el de la IA. */
  elegir?: SelectorOutfits
  listar?: () => Promise<Prenda[]>
  almacenEleccion?: AlmacenEleccion
  propsTiempo?: Omit<ComponentProps<typeof TiempoHoy>, 'alCambiar'>
  hoy?: () => Date
}

type Estado =
  | { fase: 'inicio' }
  | { fase: 'generando' }
  | { fase: 'error' }
  | { fase: 'listo'; tanda: number; resultado: ResultadoOutfits<Prenda>; armarioVacio: boolean }

const almacenPorDefecto = crearAlmacenEleccionLocal()
const compartidorPorDefecto = typeof navigator === 'undefined' ? {} : navigator

function conMayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1)
}

export function Outfits({
  elegir = outfitsPorReglas,
  listar = listarPrendas,
  almacenEleccion = almacenPorDefecto,
  propsTiempo,
  hoy = () => new Date(),
  componer = crearCollage,
  guardar = guardarOutfit,
  marcar = marcarFavorito,
  compartidor = compartidorPorDefecto,
}: Props) {
  const [eleccion, setEleccion] = useState<Eleccion>(() => almacenEleccion.leer())
  const [tiempo, setTiempo] = useState<DatosTiempo | null>(null)
  const [estado, setEstado] = useState<Estado>({ fase: 'inicio' })
  const intentos = useRef(0)

  function elegirValor(cambio: Partial<Eleccion>) {
    const nueva = { ...eleccion, ...cambio }
    setEleccion(nueva)
    almacenEleccion.guardar(nueva)
  }

  async function generar() {
    const intento = ++intentos.current
    setEstado({ fase: 'generando' })
    try {
      const prendas = await listar()
      const fecha = tiempo?.fecha ?? fechaLocal(hoy())
      const resultado = await elegir({ prendas, ...eleccion, tiempo, fecha }, intento)
      if (intento !== intentos.current) return
      setEstado({ fase: 'listo', tanda: intento, resultado, armarioVacio: prendas.length === 0 })
    } catch (fallo) {
      console.error(fallo)
      if (intento === intentos.current) setEstado({ fase: 'error' })
    }
  }

  const generando = estado.fase === 'generando'
  const listo = estado.fase === 'listo' ? estado : null

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
            className="min-h-11 w-full rounded-xl border border-black/15 bg-white px-3"
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
            className="min-h-11 w-full rounded-xl border border-black/15 bg-white px-3"
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
        <button
          type="button"
          onClick={() => void generar()}
          disabled={generando}
          className="min-h-12 rounded-xl bg-tinta px-4 text-lg font-semibold text-papel disabled:opacity-60"
        >
          {generando ? 'Generando…' : listo?.resultado.outfits.length ? 'Generar otros' : 'Generar'}
        </button>
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
        {listo && <Avisos avisos={listo.resultado.avisos} armarioVacio={listo.armarioVacio} />}
      </div>

      {listo && listo.resultado.outfits.length > 0 && (
        <Resultado
          key={listo.tanda}
          resultado={listo.resultado}
          nombreFichero={`percha-outfits-${fechaLocal(hoy())}.jpg`}
          componer={componer}
          guardar={guardar}
          marcar={marcar}
          compartidor={compartidor}
        />
      )}
    </Pantalla>
  )
}

function Avisos({ avisos, armarioVacio }: { avisos: string[]; armarioVacio: boolean }) {
  if (!armarioVacio && avisos.length === 0) return null
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white/60 p-4">
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
