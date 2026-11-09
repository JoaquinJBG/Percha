import { describe, expect, it, vi } from 'vitest'
import type { Ajustes, Categoria } from '../datos/modelo.ts'
import {
  comprobarUrlProbador,
  crearClienteProbador,
  ErrorProbador,
  INTERVALO_MS,
  leerConfigProbador,
  prendasParaProbador,
  probarEnPC,
  segundosRestantes,
  seguirPrueba,
  type Progreso,
} from './index.ts'
import { CLAVE_FALSA, servidorFalso, URL_FALSA } from './servidorFalso.ts'

const persona = new Blob(['persona'], { type: 'image/jpeg' })
const sinEsperas = () => Promise.resolve()

function cliente(opciones: Parameters<typeof servidorFalso>[0] = {}, clave = CLAVE_FALSA) {
  const servidor = servidorFalso(opciones)
  return {
    servidor,
    cliente: crearClienteProbador({ url: `${URL_FALSA}/`, clave }, { fetch: servidor.fetch }),
  }
}

function prenda(categoria: Categoria, abrigo = 2, nombre: string = categoria) {
  return { categoria, abrigo, nombre }
}

describe('prendasParaProbador', () => {
  it('manda primero lo de abajo y luego lo de arriba, sin calzado ni accesorios', () => {
    const camiseta = prenda('superior')
    const vaquero = prenda('inferior')
    const { envio, fuera } = prendasParaProbador([
      camiseta,
      prenda('calzado'),
      vaquero,
      prenda('accesorio'),
    ])

    expect(envio).toEqual([
      { prenda: vaquero, zona: 'abajo' },
      { prenda: camiseta, zona: 'arriba' },
    ])
    expect(fuera).toEqual([])
  })

  it('de varias de arriba, manda solo la más exterior y dice cuáles se quedan fuera', () => {
    const camiseta = prenda('superior', 1)
    const jersey = prenda('superior', 3)
    const parka = prenda('abrigo', 4)

    const conAbrigo = prendasParaProbador([camiseta, parka, jersey, prenda('inferior')])
    expect(conAbrigo.envio.map((e) => e.prenda)).toContain(parka)
    expect(conAbrigo.fuera).toEqual([camiseta, jersey])

    const sinAbrigo = prendasParaProbador([camiseta, jersey])
    expect(sinAbrigo.envio).toEqual([{ prenda: jersey, zona: 'arriba' }])
    expect(sinAbrigo.fuera).toEqual([camiseta])
  })

  it('el vestido va solo', () => {
    const vestido = prenda('vestido')
    const chaqueta = prenda('abrigo')

    expect(prendasParaProbador([chaqueta, vestido, prenda('calzado')])).toEqual({
      envio: [{ prenda: vestido, zona: 'entero' }],
      fuera: [chaqueta],
    })
  })

  it('sin ropa que vestir no manda nada', () => {
    expect(prendasParaProbador([prenda('calzado')]).envio).toEqual([])
  })
})

describe('comprobarUrlProbador', () => {
  it('admite https y localhost en http', () => {
    expect(comprobarUrlProbador(' https://pc-casa.tail1234.ts.net/ ')).toBeNull()
    expect(comprobarUrlProbador('http://localhost:7861')).toBeNull()
    expect(comprobarUrlProbador('http://127.0.0.1:7861')).toBeNull()
  })

  it('rechaza http a otra máquina y lo que no es una URL', () => {
    expect(comprobarUrlProbador('http://192.168.1.20:7861')).toMatch(/https:\/\//)
    expect(comprobarUrlProbador('pc-casa.ts.net')).toMatch(/dirección entera/)
  })
})

describe('leerConfigProbador', () => {
  const ajustes = (cambios: Partial<Ajustes>): (() => Promise<Ajustes>) => {
    return () =>
      Promise.resolve({
        claveGemini: null,
        modeloGemini: 'm',
        urlProbador: null,
        claveProbador: null,
        ...cambios,
      })
  }

  it('solo hay probador con URL y clave', async () => {
    expect(await leerConfigProbador(ajustes({ urlProbador: URL_FALSA }))).toBeNull()
    expect(
      await leerConfigProbador(ajustes({ urlProbador: URL_FALSA, claveProbador: CLAVE_FALSA })),
    ).toEqual({ url: URL_FALSA, clave: CLAVE_FALSA })
  })
})

describe('cliente del probador', () => {
  it('pregunta por la salud con la clave y sin la barra del final', async () => {
    const { cliente: c, servidor } = cliente()

    await expect(c.salud()).resolves.toMatchObject({ ok: true, ocupado: false })
    expect(servidor.peticiones[0]).toMatchObject({
      metodo: 'GET',
      ruta: '/salud',
      autorizacion: `Bearer ${CLAVE_FALSA}`,
    })
  })

  it('PC apagado: falla con «red»', async () => {
    const { cliente: c } = cliente({ caido: true })

    await expect(c.salud()).rejects.toMatchObject({ motivo: 'red' })
  })

  it('si no responde en 3 s, falla con «red»', async () => {
    vi.useFakeTimers()
    try {
      const colgado = (_: RequestInfo | URL, init: RequestInit = {}) =>
        new Promise<Response>((_resolver, rechazar) => {
          init.signal?.addEventListener('abort', () => {
            rechazar(init.signal?.reason as Error)
          })
        })
      const c = crearClienteProbador({ url: URL_FALSA, clave: CLAVE_FALSA }, { fetch: colgado })

      const salud = expect(c.salud()).rejects.toMatchObject({ motivo: 'red' })
      await vi.advanceTimersByTimeAsync(3000)
      await salud
    } finally {
      vi.useRealTimers()
    }
  })

  it('clave mala: 401 → «clave»', async () => {
    const { cliente: c } = cliente({}, 'otra')

    await expect(c.salud()).rejects.toEqual(new ErrorProbador('clave', 'HTTP 401'))
  })

  it('ocupado: 409 → «ocupado»', async () => {
    const { cliente: c } = cliente({ ocupado: true })

    await expect(c.crearPrueba(persona, [])).rejects.toMatchObject({ motivo: 'ocupado' })
  })

  it('una foto que el PC no puede abrir: 400 «imagen» → «imagen»', async () => {
    const malo = () => Promise.resolve(Response.json({ error: 'imagen' }, { status: 400 }))
    const c = crearClienteProbador({ url: URL_FALSA, clave: CLAVE_FALSA }, { fetch: malo })

    await expect(c.crearPrueba(persona, [])).rejects.toMatchObject({ motivo: 'imagen' })
  })

  it('una respuesta que no es del probador → «servidor»', async () => {
    const raro = () => Promise.resolve(new Response('<html>', { status: 200 }))
    const c = crearClienteProbador({ url: URL_FALSA, clave: CLAVE_FALSA }, { fetch: raro })

    await expect(c.salud()).rejects.toMatchObject({ motivo: 'servidor' })
  })

  it('cancelar desde fuera no se confunde con «no responde»', async () => {
    const { cliente: c } = cliente()
    const control = new AbortController()
    control.abort(new DOMException('fuera', 'AbortError'))

    await expect(c.salud(control.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('probarEnPC', () => {
  const vaquero = new Blob(['vaquero'], { type: 'image/png' })
  const camisa = new Blob(['camisa'], { type: 'image/png' })

  it('manda persona y prendas en orden, sigue el progreso cada 3 s y trae la imagen', async () => {
    const { cliente: c, servidor } = cliente()
    const progresos: Progreso[] = []
    const esperar = vi.fn(sinEsperas)

    const imagen = await probarEnPC(
      c,
      persona,
      [
        { foto: vaquero, zona: 'abajo' },
        { foto: camisa, zona: 'arriba' },
      ],
      { alProgreso: (p) => progresos.push(p), esperar },
    )

    expect(imagen.type).toBe('image/jpeg')
    expect(await imagen.text()).toBe(servidor.imagen)
    const datos = servidor.peticiones.find((p) => p.metodo === 'POST')?.datos
    expect(datos?.get('persona')).toBeInstanceOf(Blob)
    expect(datos?.getAll('zona')).toEqual(['abajo', 'arriba'])
    expect((datos?.getAll('prenda') as File[]).map((f) => f.name)).toEqual([
      'prenda-1.png',
      'prenda-2.png',
    ])
    expect(progresos.map((p) => `${p.estado} ${String(p.hechas)}/${String(p.total)}`)).toEqual([
      'en-cola 0/2',
      'probando 1/2',
      'lista 2/2',
    ])
    expect(esperar).toHaveBeenCalledWith(INTERVALO_MS, undefined)
  })

  it('aguanta un corte de red corto a mitad de la prueba', async () => {
    const { cliente: c } = cliente({ cortesEstado: [1, 2] })

    await expect(
      probarEnPC(c, persona, [{ foto: camisa, zona: 'arriba' }], {
        alProgreso: () => undefined,
        esperar: sinEsperas,
      }),
    ).resolves.toHaveProperty('type', 'image/jpeg')
  })

  it('si la red no vuelve, falla con «red» y la prueba se puede seguir con su id', async () => {
    const { cliente: c } = cliente({ cortesEstado: [1, 2, 3] })
    const progresos: Progreso[] = []

    await expect(
      probarEnPC(c, persona, [{ foto: camisa, zona: 'arriba' }], {
        alProgreso: (p) => progresos.push(p),
        esperar: sinEsperas,
      }),
    ).rejects.toMatchObject({ motivo: 'red' })

    const id = progresos[0]?.id ?? ''
    await expect(
      seguirPrueba(c, id, { alProgreso: () => undefined, esperar: sinEsperas }),
    ).resolves.toHaveProperty('type', 'image/jpeg')
  })

  it('una prueba que acaba en error en el PC falla con «prueba»', async () => {
    const { cliente: c } = cliente({ errorPrueba: 'sin memoria en la GPU' })

    await expect(
      probarEnPC(c, persona, [{ foto: camisa, zona: 'arriba' }], {
        alProgreso: () => undefined,
        esperar: sinEsperas,
      }),
    ).rejects.toMatchObject({ motivo: 'prueba', message: 'prueba: sin memoria en la GPU' })
  })

  it('se deja de preguntar al cancelar (por ejemplo, al salir de la pantalla)', async () => {
    const { cliente: c, servidor } = cliente()
    const control = new AbortController()

    const prueba = probarEnPC(c, persona, [{ foto: camisa, zona: 'arriba' }], {
      alProgreso: () => {
        control.abort(new DOMException('fuera', 'AbortError'))
      },
      signal: control.signal,
    })

    await expect(prueba).rejects.toMatchObject({ name: 'AbortError' })
    expect(servidor.peticiones.filter((p) => p.ruta.startsWith('/pruebas/'))).toEqual([])
  })
})

describe('segundosRestantes', () => {
  it('cuenta unos 80 s por prenda que queda', () => {
    expect(segundosRestantes({ hechas: 1, total: 3 })).toBe(160)
    expect(segundosRestantes({ hechas: 3, total: 3 })).toBe(0)
  })
})
