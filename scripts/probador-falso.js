// Probador falso para ver T7.1 en `pnpm dev` sin el PC de verdad: cumple el contrato de la fase 7
// (rutas, clave, CORS, una prueba a la vez) y «viste» devolviendo la foto de la persona.
//
//   node scripts/probador-falso.js            → http://127.0.0.1:7861, clave nueva en la consola
//   PROBADOR_SEGUNDOS=20 node scripts/…       → segundos por prenda (por defecto, 8)
//   PROBADOR_FALLO=1 node scripts/…           → la prueba acaba en error
//
// Solo para desarrollo: escucha en 127.0.0.1 y no guarda nada en disco.
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const PUERTO = Number(process.env.PROBADOR_PUERTO ?? 7861)
const CLAVE = process.env.PROBADOR_CLAVE ?? randomBytes(24).toString('base64url')
const SEGUNDOS = Number(process.env.PROBADOR_SEGUNDOS ?? 8)
const FALLO = process.env.PROBADOR_FALLO === '1'
const ORIGENES =
  /^(http:\/\/localhost:\d+|https:\/\/percha\.joaquinjesusbeltrangarcia\.workers\.dev)$/
const ZONAS = new Set(['abajo', 'arriba', 'entero'])

/** @type {Map<string, { total: number, inicio: number, persona: Blob }>} */
const pruebas = new Map()

function cabecerasCors(peticion) {
  const origen = peticion.headers.origin ?? ''
  return ORIGENES.test(origen)
    ? {
        'Access-Control-Allow-Origin': origen,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Private-Network': 'true',
        Vary: 'Origin',
      }
    : {}
}

function estadoDe(prueba) {
  const segundos = (Date.now() - prueba.inicio) / 1000
  const hechas = Math.min(prueba.total, Math.floor(segundos / SEGUNDOS))
  const acabada = hechas >= prueba.total
  return {
    estado: acabada
      ? FALLO
        ? 'error'
        : 'lista'
      : hechas === 0 && segundos < 2
        ? 'en-cola'
        : 'probando',
    hechas,
    total: prueba.total,
    segundos: Math.round(segundos),
    error: acabada && FALLO ? 'fallo simulado' : null,
  }
}

function ocupado() {
  return [...pruebas.values()].some((p) => estadoDe(p).estado !== 'lista')
}

async function leerCuerpo(peticion) {
  const trozos = []
  for await (const trozo of peticion) trozos.push(trozo)
  return Buffer.concat(trozos)
}

const servidor = createServer(async (peticion, respuesta) => {
  const cors = cabecerasCors(peticion)
  const enviar = (estado, cuerpo, tipo = 'application/json') => {
    respuesta.writeHead(estado, { ...cors, 'Content-Type': tipo })
    respuesta.end(tipo === 'application/json' ? JSON.stringify(cuerpo) : cuerpo)
  }
  if (peticion.method === 'OPTIONS') {
    respuesta.writeHead(204, cors)
    respuesta.end()
    return
  }
  const url = new URL(peticion.url ?? '/', `http://127.0.0.1:${String(PUERTO)}`)
  console.log(peticion.method, url.pathname)
  if (peticion.headers.authorization !== `Bearer ${CLAVE}`) return enviar(401, { error: 'clave' })

  if (url.pathname === '/salud') {
    return enviar(200, { ok: true, modelo: 'catvton', version: 1, ocupado: ocupado() })
  }
  if (url.pathname === '/pruebas' && peticion.method === 'POST') {
    if (ocupado()) return enviar(409, { error: 'ocupado' })
    const cuerpo = await leerCuerpo(peticion)
    if (cuerpo.length > 20 * 1024 * 1024) return enviar(413, { error: 'grande' })
    const datos = await new Request('http://x', {
      method: 'POST',
      headers: { 'Content-Type': peticion.headers['content-type'] ?? '' },
      body: cuerpo,
    }).formData()
    const persona = datos.get('persona')
    const prendas = datos.getAll('prenda')
    const zonas = datos.getAll('zona')
    if (!(persona instanceof Blob)) return enviar(400, { error: 'sin-persona' })
    if (prendas.length === 0) return enviar(400, { error: 'sin-prendas' })
    if (zonas.length !== prendas.length || !zonas.every((z) => ZONAS.has(String(z)))) {
      return enviar(400, { error: 'zona' })
    }
    const id = randomUUID()
    pruebas.set(id, { total: prendas.length, inicio: Date.now(), persona })
    console.log(`  prueba ${id}: ${zonas.join(', ')}`)
    return enviar(202, { id, total: prendas.length })
  }
  const [, raiz, id, resto] = url.pathname.split('/')
  const prueba = raiz === 'pruebas' ? pruebas.get(id ?? '') : undefined
  if (!prueba) return enviar(404, { error: 'no-existe' })
  if (resto === 'imagen') {
    if (estadoDe(prueba).estado !== 'lista') return enviar(404, { error: 'no-lista' })
    return enviar(
      200,
      Buffer.from(await prueba.persona.arrayBuffer()),
      prueba.persona.type || 'image/jpeg',
    )
  }
  return enviar(200, estadoDe(prueba))
})

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(
    `Probador falso en http://127.0.0.1:${String(PUERTO)} (${String(SEGUNDOS)} s por prenda)`,
  )
  console.log(`Clave: ${CLAVE}`)
})
