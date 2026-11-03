import { crearServicioTiempo } from './servicio.ts'

export { crearServicioTiempo, type OpcionesServicio, type ServicioTiempo } from './servicio.ts'
export { obtenerUbicacion, NOMBRE_MI_UBICACION, type OpcionesUbicacion } from './ubicacion.ts'
export { crearAlmacenSitioLocal, type AlmacenSitio, type SitioRecordado } from './sitioRecordado.ts'
export {
  ErrorTiempo,
  type Precipitacion,
  type Sitio,
  type Termico,
  type TiempoHoy,
  type TipoErrorTiempo,
} from './tipos.ts'

const servicio = crearServicioTiempo()

/** Ciudades que coinciden con el texto (hasta 5, en español). Lista vacía si no hay ninguna. */
export const buscarCiudades = servicio.buscarCiudades
/** El tiempo de hoy en el sitio, con caché de 1 h en memoria y `localStorage`. */
export const tiempoDeHoy = servicio.tiempoDeHoy
