export interface Aviso {
  tipo: 'bien' | 'error'
  texto: string
}

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
export const botonPrincipal = `${boton} bg-oliva text-papel`
export const botonSecundario = `${boton} border border-tinta/25 text-tinta`
export const campoTexto =
  'min-h-12 w-full min-w-0 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva aria-invalid:border-red-800'

export function claseChip(marcado: boolean): string {
  return `min-h-10 rounded-full border px-3 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva ${
    marcado ? 'border-oliva bg-oliva text-papel' : 'border-tinta/25 text-tinta'
  }`
}
