export interface Sitio {
  nombre: string
  /** Región y país, para distinguir ciudades con el mismo nombre. */
  detalle?: string
  latitud: number
  longitud: number
}

export type Termico = 'frio' | 'fresco' | 'templado' | 'calor'
export type Precipitacion = 'lluvia' | 'nieve'

export interface TiempoHoy {
  sitio: Sitio
  /** Zona horaria IANA del sitio, p. ej. `Europe/Madrid`. */
  zonaHoraria: string
  /** Fecha de hoy en el sitio (`AAAA-MM-DD`). */
  fecha: string
  /** Hora local del sitio de la medida actual (`AAAA-MM-DDTHH:MM`). */
  hora: string
  /** °C */
  temperatura: { actual: number; minima: number; maxima: number }
  /** Sensación térmica en °C. */
  sensacion: { actual: number; minima: number; maxima: number }
  /** Probabilidad máxima del día en % (puede faltar) y cantidad del día en mm. */
  lluvia: { probabilidad: number | null; cantidad: number }
  /** km/h */
  viento: { actual: number; maximo: number }
  /** Código WMO del día. */
  codigo: number
  clima: { termico: Termico; precipitacion: Precipitacion | null; viento: boolean }
  /** «frío y lluvia», «calor», «templado y viento»… */
  resumen: string
}

export type TipoErrorTiempo =
  'sin-red' | 'servicio' | 'permiso-denegado' | 'sin-ubicacion' | 'tiempo-agotado' | 'no-disponible'

export class ErrorTiempo extends Error {
  readonly tipo: TipoErrorTiempo

  constructor(tipo: TipoErrorTiempo, mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones)
    this.name = 'ErrorTiempo'
    this.tipo = tipo
  }
}
