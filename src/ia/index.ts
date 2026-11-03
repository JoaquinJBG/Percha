import { leerAjustes } from '../datos/repositorio.ts'
import { crearProveedorGemini } from './gemini.ts'
import type { ProveedorIA } from './tipos.ts'

export { ErrorIA, type TipoErrorIA } from './errores.ts'
export { crearProveedorFalso, ETIQUETAS_DE_PRUEBA, type ProveedorFalso } from './falso.ts'
export { crearProveedorGemini, type ClienteGemini, type OpcionesGemini } from './gemini.ts'
export * from './tipos.ts'

/** El proveedor con la clave y el modelo de Ajustes. Sin clave, sus llamadas lanzan `sin-clave`. */
export async function proveedorDesdeAjustes(): Promise<ProveedorIA> {
  const { claveGemini, modeloGemini } = await leerAjustes()
  return crearProveedorGemini({ clave: claveGemini, modelo: modeloGemini })
}
