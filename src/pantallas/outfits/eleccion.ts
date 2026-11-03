import { z } from 'zod'
import { estiloSchema, ocasionSchema, type Estilo, type Ocasion } from '../../datos/modelo.ts'

export interface Eleccion {
  estilo: Estilo
  ocasion: Ocasion
}

export interface AlmacenEleccion {
  leer: () => Eleccion
  guardar: (eleccion: Eleccion) => void
}

export const ELECCION_POR_DEFECTO: Eleccion = { estilo: 'casual', ocasion: 'diario' }
const CLAVE = 'percha:outfits:eleccion'

const eleccionSchema = z.object({
  estilo: estiloSchema.catch(ELECCION_POR_DEFECTO.estilo),
  ocasion: ocasionSchema.catch(ELECCION_POR_DEFECTO.ocasion),
})

/** La última elección de estilo y ocasión, en `localStorage`; si falta o no vale, la de por defecto. */
export function crearAlmacenEleccionLocal(
  almacen: () => Storage = () => localStorage,
): AlmacenEleccion {
  return {
    leer() {
      try {
        const texto = almacen().getItem(CLAVE)
        if (!texto) return ELECCION_POR_DEFECTO
        const leida = eleccionSchema.safeParse(JSON.parse(texto))
        return leida.success ? leida.data : ELECCION_POR_DEFECTO
      } catch {
        return ELECCION_POR_DEFECTO
      }
    },
    guardar(eleccion) {
      try {
        almacen().setItem(CLAVE, JSON.stringify(eleccion))
      } catch {
        // Sin almacenamiento (modo incógnito lleno, permisos): se olvida al cerrar y ya está.
      }
    },
  }
}
