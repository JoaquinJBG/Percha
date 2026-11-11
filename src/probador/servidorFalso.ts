import type { EstadoPrueba } from './cliente.ts'

export const URL_FALSA = 'https://pc-casa.tail0000.ts.net'
/** Clave de mentira para los tests: nunca una de verdad (CLAUDE.md). */
export const CLAVE_FALSA = 'clave-de-prueba-del-probador'

export interface OpcionesServidorFalso {
  /** `salud` dice que está ocupado y `POST /pruebas` da 409. */
  ocupado?: boolean
  /** Ninguna ruta responde: como un PC apagado o sin Tailscale. */
  caido?: boolean
  /** La prueba acaba en `error` con este texto en vez de en `lista`. */
  errorPrueba?: string
  /** Consultas de estado (desde la primera) que fallan por red, para simular un corte a mitad. */
  cortesEstado?: number[]
}

export interface PeticionFalsa {
  metodo: string
  ruta: string
  autorizacion: string | null
  datos: FormData | null
}

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Un `fetch` que hace de servidor del probador según el contrato de T7.1, sin red: cada consulta de
 * estado viste una prenda más. Apunta cada petición para que los tests miren qué se mandó.
 */
export function servidorFalso(opciones: OpcionesServidorFalso = {}) {
  const peticiones: PeticionFalsa[] = []
  // Texto y no Blob: el Blob de jsdom no sirve de cuerpo de un `Response` de Node.
  const imagen = 'jpeg-del-probador'
  let prueba: { id: string; total: number; hechas: number } | null = null
  let consultas = 0

  const fetch = async (entrada: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada))
    const metodo = init.method ?? 'GET'
    const autorizacion = new Headers(init.headers).get('Authorization')
    const datos = init.body instanceof FormData ? init.body : null
    peticiones.push({ metodo, ruta: url.pathname, autorizacion, datos })
    await Promise.resolve()
    if (init.signal?.aborted) throw init.signal.reason
    if (opciones.caido) throw new TypeError('Failed to fetch')
    if (autorizacion !== `Bearer ${CLAVE_FALSA}`) return json({ error: 'clave' }, 401)

    if (url.pathname === '/salud') {
      return json({ ok: true, modelo: 'catvton', version: 1, ocupado: Boolean(opciones.ocupado) })
    }
    if (url.pathname === '/pruebas' && metodo === 'POST') {
      if (opciones.ocupado) return json({ error: 'ocupado' }, 409)
      const total = datos?.getAll('prenda').length ?? 0
      if (!datos?.get('persona')) return json({ error: 'sin-persona' }, 400)
      if (total === 0) return json({ error: 'sin-prendas' }, 400)
      prueba = { id: 'prueba-1', total, hechas: 0 }
      return json({ id: prueba.id, total }, 202)
    }
    const [, raiz, id, resto] = url.pathname.split('/')
    if (raiz !== 'pruebas' || !prueba || id !== prueba.id) return json({ error: 'no' }, 404)
    if (resto === 'imagen') {
      return prueba.hechas >= prueba.total
        ? new Response(imagen, { headers: { 'Content-Type': 'image/jpeg' } })
        : json({ error: 'no-lista' }, 404)
    }
    consultas += 1
    if (opciones.cortesEstado?.includes(consultas)) throw new TypeError('Failed to fetch')
    prueba.hechas = Math.min(prueba.total, prueba.hechas + 1)
    const lista = prueba.hechas >= prueba.total
    const cuerpo: EstadoPrueba = {
      estado: lista ? (opciones.errorPrueba ? 'error' : 'lista') : 'probando',
      hechas: prueba.hechas,
      total: prueba.total,
      segundos: prueba.hechas * 80,
      error: lista ? (opciones.errorPrueba ?? null) : null,
    }
    return json(cuerpo)
  }

  return { fetch, peticiones, imagen }
}
