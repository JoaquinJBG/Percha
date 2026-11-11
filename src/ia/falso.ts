import { capasDe } from '../datos/capas.ts'
import type { DatosEtiqueta, EtiquetasPrenda } from '../datos/modelo.ts'
import { ErrorIA } from './errores.ts'
import {
  MAX_PRENDAS_POR_PETICION,
  type PeticionOutfits,
  type PrendaAEtiquetar,
  type PrendaParaOutfit,
  type PropuestaOutfit,
  type ProveedorIA,
  type PrendaABuscar,
  type ResultadoEtiquetado,
  type ResultadoFicha,
} from './tipos.ts'

export const ETIQUETAS_DE_PRUEBA: EtiquetasPrenda = {
  categoria: 'superior',
  subcategoria: 'camiseta',
  colores: ['blanco'],
  estampado: 'liso',
  estilos: ['casual', 'minimalista'],
  abrigo: 2,
  formalidad: 2,
  ocasiones: ['diario'],
  temporadas: ['primavera', 'verano'],
  notas: '',
  capas: ['base'],
  corte: 'regular',
  largo: 'regular',
  manga: 'corta',
}

/** Una etiqueta de Zara: con ella salen los enlaces de búsqueda de `src/etiqueta/`. */
export const ETIQUETA_DE_PRUEBA: DatosEtiqueta = {
  marca: 'Zara',
  referencia: '4085/021',
  talla: 'M',
  composicion: [
    { material: 'algodón', porcentaje: 95 },
    { material: 'elastano', porcentaje: 5 },
  ],
}

export interface OpcionesProveedorFalso {
  /** Qué encuentra `buscarFicha`; por defecto, `fichaDePrueba`. */
  ficha?: (prenda: PrendaABuscar) => ResultadoFicha
  /** Qué devuelve para cada prenda; por defecto, `ETIQUETAS_DE_PRUEBA`. */
  etiquetas?: (prenda: PrendaAEtiquetar, indice: number) => EtiquetasPrenda | null
  /** Qué outfits propone; por defecto, `outfitsDePrueba`. */
  outfits?: (peticion: PeticionOutfits) => PropuestaOutfit[]
  /** Qué lee de la foto de una etiqueta; por defecto, `ETIQUETA_DE_PRUEBA`. */
  etiqueta?: (foto: Blob) => DatosEtiqueta
  /** Si se da, todas las llamadas lo lanzan. */
  error?: ErrorIA
}

export interface ProveedorFalso extends ProveedorIA {
  /** Los lotes recibidos por `etiquetarPrendas`, en orden. */
  readonly lotes: PrendaAEtiquetar[][]
  /** Las peticiones recibidas por `elegirOutfits`, en orden. */
  readonly peticionesOutfits: PeticionOutfits[]
  /** Las fotos recibidas por `leerEtiqueta`, en orden. */
  readonly etiquetasLeidas: Blob[]
  readonly comprobaciones: number
  /** Las prendas recibidas por `buscarFicha`, en orden. */
  readonly fichasBuscadas: PrendaABuscar[]
}

// Una camiseta dibujada: así la foto de catálogo se ve en `pnpm dev` sin pedir nada fuera.
const FOTO_DE_PRUEBA = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><rect width="120" height="160" fill="#f4f1ea"/><path d="M35 30l25-10 25 10 20 20-15 15-10-8v73H40V57l-10 8-15-15z" fill="#6b7a3a"/></svg>',
)}`

/** Lo que encuentra el falso: dos candidatas con la marca y el tipo de la prenda, la primera con foto. */
export function fichaDePrueba(prenda: PrendaABuscar): ResultadoFicha {
  const nombre = [prenda.subcategoria || prenda.categoria, prenda.marca].filter(Boolean).join(' ')
  return {
    candidatas: [
      {
        nombre: `${nombre} (prueba)`,
        enlace: 'https://example.com/ficha-1',
        foto: FOTO_DE_PRUEBA,
        tienda: prenda.marca ?? 'Tienda de prueba',
      },
      {
        nombre: `${nombre} parecida`,
        enlace: 'https://example.com/ficha-2',
        foto: null,
        tienda: null,
      },
    ],
    fuentes: [{ titulo: 'example.com', enlace: 'https://example.com/' }],
    busquedas: [nombre],
    tokens: { entrada: 1200, salida: 150, total: 1350 },
    ms: 1500,
    modelo: 'falso',
  }
}

/**
 * Hasta 4 outfits válidos y sencillos: la i-ésima base de arriba con la i-ésima de abajo (o el i-ésimo
 * vestido) y un calzado. Si hoy hace falta capa exterior, una; si es opcional, una tercera pieza en el
 * primero y el tercero.
 */
export function outfitsDePrueba({ prendas, tiempo }: PeticionOutfits): PropuestaOutfit[] {
  const ids = (vale: (p: PrendaParaOutfit) => boolean) => prendas.filter(vale).map((p) => p.id)
  const bajos = ids((p) => p.categoria === 'inferior')
  const calzados = ids((p) => p.categoria === 'calzado')
  const exteriores = ids((p) => capasDe(p).includes('exterior'))
  const opcionales = ids((p) => p.opcional === true)
  const bases: string[][] = [
    ...ids((p) => capasDe(p).includes('base')).flatMap((arriba, i) => {
      const abajo = bajos[i % Math.max(bajos.length, 1)]
      return abajo ? [[arriba, abajo]] : []
    }),
    ...ids((p) => p.categoria === 'vestido').map((vestido) => [vestido]),
  ]
  if (calzados.length === 0) return []
  return bases.slice(0, 4).map((base, i) => {
    const libres = (lista: string[]) => lista.filter((id) => !base.includes(id))
    let encima: string | undefined
    if (tiempo.exterior === 'obligatoria') {
      const posibles = libres(exteriores)
      encima = posibles[i % Math.max(posibles.length, 1)]
    } else if (tiempo.exterior === 'opcional' && i % 2 === 0) {
      encima = libres(opcionales)[0]
    }
    const calzado = calzados[i % calzados.length] ?? ''
    return {
      prendas: [...base, ...(encima ? [encima] : []), calzado],
      porque: `Outfit de prueba ${String(i + 1)}.`,
    }
  })
}

/** Proveedor sin red para los tests y para probar pantallas sin clave. */
export function crearProveedorFalso({
  etiquetas = () => ETIQUETAS_DE_PRUEBA,
  outfits = outfitsDePrueba,
  etiqueta = () => ETIQUETA_DE_PRUEBA,
  ficha = fichaDePrueba,
  error,
}: OpcionesProveedorFalso = {}): ProveedorFalso {
  const fichasBuscadas: PrendaABuscar[] = []
  const lotes: PrendaAEtiquetar[][] = []
  const etiquetasLeidas: Blob[] = []
  const peticionesOutfits: PeticionOutfits[] = []
  let comprobaciones = 0
  return {
    lotes,
    peticionesOutfits,
    etiquetasLeidas,
    fichasBuscadas,
    get comprobaciones() {
      return comprobaciones
    },
    etiquetarPrendas(prendas) {
      // Mismo contrato que Gemini: hasta 5 prendas con 1–2 fotos cada una.
      if (
        prendas.length > MAX_PRENDAS_POR_PETICION ||
        prendas.some(({ fotos }) => fotos.length < 1 || fotos.length > 2)
      ) {
        return Promise.reject(new RangeError('Lote no válido'))
      }
      lotes.push(prendas)
      if (error) return Promise.reject(error)
      const resultado: ResultadoEtiquetado = prendas.map(etiquetas)
      if (resultado.length > 0 && resultado.every((e) => e === null)) {
        return Promise.reject(new ErrorIA('respuesta'))
      }
      return Promise.resolve(resultado)
    },
    elegirOutfits(peticion) {
      peticionesOutfits.push(peticion)
      if (error) return Promise.reject(error)
      const propuestas = outfits(peticion)
      // Igual que Gemini: sin ningún outfit con forma válida, la respuesta no vale.
      return propuestas.length === 0
        ? Promise.reject(new ErrorIA('respuesta'))
        : Promise.resolve(propuestas)
    },
    leerEtiqueta(foto) {
      etiquetasLeidas.push(foto)
      return error ? Promise.reject(error) : Promise.resolve(etiqueta(foto))
    },
    buscarFicha(prenda) {
      fichasBuscadas.push(prenda)
      return error ? Promise.reject(error) : Promise.resolve(ficha(prenda))
    },
    comprobarClave() {
      comprobaciones++
      return error ? Promise.reject(error) : Promise.resolve()
    },
  }
}
