import type { Sitio } from './tipos.ts'

/**
 * Dónde se guarda el último sitio elegido. Hoy va en `localStorage`; cuando exista el
 * almacén de ajustes de `src/datos/` bastará con otra implementación.
 */
export interface AlmacenSitio {
  leer(): Sitio | null
  guardar(sitio: Sitio): void
}

const CLAVE = 'percha:sitio'

export function crearAlmacenSitioLocal(almacen: Storage | null = almacenLocal()): AlmacenSitio {
  return {
    leer() {
      try {
        const texto = almacen?.getItem(CLAVE)
        if (!texto) return null
        const valor: unknown = JSON.parse(texto)
        return esSitio(valor) ? valor : null
      } catch {
        return null
      }
    },
    guardar(sitio) {
      try {
        almacen?.setItem(CLAVE, JSON.stringify(sitio))
      } catch {
        // Sin almacén se pierde solo la comodidad de no volver a elegir el sitio.
      }
    },
  }
}

function almacenLocal(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function esSitio(valor: unknown): valor is Sitio {
  if (typeof valor !== 'object' || valor === null) return false
  const sitio = valor as Record<string, unknown>
  return (
    typeof sitio.nombre === 'string' &&
    typeof sitio.latitud === 'number' &&
    typeof sitio.longitud === 'number' &&
    (sitio.detalle === undefined || typeof sitio.detalle === 'string')
  )
}
