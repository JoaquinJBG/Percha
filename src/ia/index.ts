import { leerAjustes } from '../datos/repositorio.ts'
import { crearProveedorGemini } from './gemini.ts'
import type { ProveedorIA } from './tipos.ts'

export { ErrorIA, type TipoErrorIA } from './errores.ts'
export {
  crearProveedorFalso,
  ETIQUETA_DE_PRUEBA,
  ETIQUETAS_DE_PRUEBA,
  fichaDePrueba,
  outfitsDePrueba,
  type ProveedorFalso,
} from './falso.ts'
export {
  crearProveedorGemini,
  MODELO_BUSQUEDA,
  type ClienteGemini,
  type OpcionesGemini,
} from './gemini.ts'
export { OUTFITS_POR_PETICION } from './esquema-outfits.ts'
export * from './tipos.ts'

/** El proveedor con la clave y el modelo de Ajustes. Sin clave, sus llamadas lanzan `sin-clave`. */
export async function proveedorDesdeAjustes(): Promise<ProveedorIA> {
  const { claveGemini, modeloGemini } = await leerAjustes()
  return crearProveedorGemini({ clave: claveGemini, modelo: modeloGemini })
}
