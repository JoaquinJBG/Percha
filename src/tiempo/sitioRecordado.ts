import { almacenLocal } from './almacen.ts'
import type { Sitio } from './tipos.ts'

/** De la ubicación se recuerda solo que se quiere usar: sus coordenadas caducan al moverse. */
export type SitioRecordado = { tipo: 'ciudad'; sitio: Sitio } | { tipo: 'ubicacion' }

/**
 * Dónde se guarda el último sitio elegido. Hoy va en `localStorage`; cuando exista el
 * almacén de ajustes de `src/datos/` bastará con otra implementación.
 */
export interface AlmacenSitio {
  leer(): SitioRecordado | null
  guardar(recordado: SitioRecordado): void
}

const CLAVE = 'percha:sitio'

export function crearAlmacenSitioLocal(almacen: Storage | null = almacenLocal()): AlmacenSitio {
  return {
    leer() {
      try {
        const texto = almacen?.getItem(CLAVE)
        if (!texto) return null
        const valor: unknown = JSON.parse(texto)
        return esSitioRecordado(valor) ? valor : null
      } catch {
        return null
      }
    },
    guardar(recordado) {
      try {
        almacen?.setItem(CLAVE, JSON.stringify(recordado))
      } catch {
        // Sin almacén se pierde solo la comodidad de no volver a elegir el sitio.
      }
    },
  }
}

function esSitioRecordado(valor: unknown): valor is SitioRecordado {
  if (typeof valor !== 'object' || valor === null) return false
  const recordado = valor as Record<string, unknown>
  if (recordado.tipo === 'ubicacion') return true
  return recordado.tipo === 'ciudad' && esSitio(recordado.sitio)
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
