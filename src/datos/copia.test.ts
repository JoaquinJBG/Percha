// @vitest-environment node
// jsdom tiene su propio Blob, que fake-indexeddb no sabe clonar: estos tests corren en Node.
import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { capasDe } from './capas.ts'
import {
  ErrorCopia,
  exportarCopia,
  importarCopia,
  MENSAJE_COPIA_DANADA,
  nombreFicheroCopia,
} from './copia.ts'
import { db } from './db.ts'
import { imagen, nuevaPrenda, sinBlobs, vaciarBase } from './pruebas.ts'
import {
  crearPrenda,
  guardarAjustes,
  guardarOutfit,
  guardarPerfil,
  leerAjustes,
  leerPerfil,
  leerPrenda,
  listarOutfits,
  listarPrendas,
} from './repositorio.ts'

const CLAVE_FALSA = 'clave-falsa-de-prueba'

beforeEach(vaciarBase)

async function sembrar() {
  const camiseta = await crearPrenda(nuevaPrenda())
  const zapatillas = await crearPrenda(
    nuevaPrenda({
      categoria: 'calzado',
      fotos: [
        { original: imagen(3, 'image/jpeg'), recortada: imagen(4, 'image/png') },
        { original: imagen(5, 'image/jpeg'), recortada: null },
      ],
    }),
  )
  await guardarOutfit({
    prendas: [camiseta.id, zapatillas.id],
    estilo: 'casual',
    ocasion: 'diario',
    tiempo: null,
    explicacion: 'Para el día a día.',
    favorito: true,
  })
  await guardarPerfil({ fotoCara: imagen(6), ciudad: 'Valencia', estilosFavoritos: ['boho'] })
  await guardarAjustes({ claveGemini: CLAVE_FALSA, modeloGemini: 'gemini-otro' })
  return { camiseta, zapatillas }
}

async function todo() {
  return sinBlobs({
    prendas: await listarPrendas(),
    outfits: await listarOutfits(),
    perfil: await leerPerfil(),
    ajustes: await leerAjustes(),
  })
}

/** Abre la copia, deja cambiar su `percha.json` y quitar ficheros, y la vuelve a cerrar. */
async function retocar(
  copia: Blob,
  cambiar: (json: Record<string, unknown>) => void,
  quitar: string[] = [],
): Promise<Blob> {
  const ficheros = unzipSync(new Uint8Array(await copia.arrayBuffer()))
  const json = JSON.parse(strFromU8(ficheros['percha.json'] ?? new Uint8Array())) as Record<
    string,
    unknown
  >
  cambiar(json)
  ficheros['percha.json'] = strToU8(JSON.stringify(json))
  for (const ruta of quitar) Reflect.deleteProperty(ficheros, ruta)
  return new Blob([zipSync(ficheros)])
}

describe('exportar e importar', () => {
  it('ida y vuelta: reemplazar deja todo igual, fotos incluidas', async () => {
    await sembrar()
    const antes = await todo()
    const copia = await exportarCopia()

    await vaciarBase()
    await guardarAjustes({ claveGemini: CLAVE_FALSA })
    const resumen = await importarCopia(copia, 'reemplazar')

    expect(resumen).toEqual({ prendas: 2, outfits: 1 })
    expect(await todo()).toEqual(antes)
  })

  it('los datos de la etiqueta y el enlace van y vuelven', async () => {
    const conEtiqueta = await crearPrenda(
      nuevaPrenda({
        marca: 'Zara',
        referencia: '4085/021',
        talla: 'M',
        composicion: [{ material: 'algodón', porcentaje: 100 }, { material: 'forro' }],
        enlace: 'https://www.zara.com/es/es/camiseta-p04085021.html',
      }),
    )
    const copia = await exportarCopia()

    await vaciarBase()
    await importarCopia(copia, 'reemplazar')

    expect(await sinBlobs(await leerPrenda(conEtiqueta.id))).toEqual(await sinBlobs(conEtiqueta))
  })

  it('las capas van y vuelven', async () => {
    const sobrecamisa = await crearPrenda(
      nuevaPrenda({ categoria: 'abrigo', subcategoria: 'sobrecamisa', capas: ['exterior'] }),
    )
    const copia = await exportarCopia()

    await vaciarBase()
    await importarCopia(copia, 'reemplazar')

    expect((await leerPrenda(sobrecamisa.id))?.capas).toEqual(['exterior'])
  })

  it('una copia de antes de T6.1, sin capas, se importa igual y deduce las de por defecto', async () => {
    const { camiseta } = await sembrar()
    expect(camiseta.capas).toBeUndefined()
    const copia = await exportarCopia()

    await vaciarBase()
    await importarCopia(copia, 'reemplazar')

    const leida = await leerPrenda(camiseta.id)
    expect(leida?.capas).toBeUndefined()
    expect(leida && capasDe(leida)).toEqual(['base'])
  })

  it('una copia de antes de T5.1, sin datos de etiqueta, se importa igual', async () => {
    const { camiseta } = await sembrar()
    const copia = await exportarCopia()
    const json = JSON.parse(
      strFromU8(
        unzipSync(new Uint8Array(await copia.arrayBuffer()))['percha.json'] ?? strToU8('{}'),
      ),
    ) as { prendas: Record<string, unknown>[] }
    expect(Object.keys(json.prendas[0] ?? {})).not.toContain('marca')

    await vaciarBase()
    await importarCopia(copia, 'reemplazar')

    const leida = await leerPrenda(camiseta.id)
    expect(leida?.marca).toBeUndefined()
    expect(leida?.subcategoria).toBe('camiseta')
  })

  it('reemplazar borra lo que no estaba en la copia', async () => {
    await sembrar()
    const copia = await exportarCopia()
    const sobrante = await crearPrenda(nuevaPrenda({ notas: 'nueva tras la copia' }))
    await guardarPerfil({ ciudad: 'Bilbao' })

    await importarCopia(copia, 'reemplazar')

    expect(await leerPrenda(sobrante.id)).toBeUndefined()
    expect(await db.prendas.count()).toBe(2)
    expect((await leerPerfil()).ciudad).toBe('Valencia')
  })

  it('reemplazar con una copia sin perfil deja el perfil vacío', async () => {
    const copia = await exportarCopia()
    await guardarPerfil({ ciudad: 'Bilbao' })

    await importarCopia(copia, 'reemplazar')

    expect((await leerPerfil()).ciudad).toBe('')
  })

  it('fusionar conserva lo de aquí y, con el mismo id, gana la copia', async () => {
    const { camiseta } = await sembrar()
    const copia = await exportarCopia()
    const local = await crearPrenda(nuevaPrenda({ notas: 'solo en este móvil' }))
    await db.prendas.update(camiseta.id, { notas: 'cambiada después' })

    const resumen = await importarCopia(copia, 'fusionar')

    expect(resumen).toEqual({ prendas: 2, outfits: 1 })
    expect(await db.prendas.count()).toBe(3)
    expect(await leerPrenda(local.id)).toBeDefined()
    expect((await leerPrenda(camiseta.id))?.notas).toBe('')
  })

  it('importar dos veces la misma copia no duplica nada', async () => {
    await sembrar()
    const copia = await exportarCopia()

    await importarCopia(copia, 'fusionar')
    await importarCopia(copia, 'fusionar')

    expect(await db.prendas.count()).toBe(2)
    expect(await db.outfits.count()).toBe(1)
  })

  it('una base vacía también se exporta e importa', async () => {
    const copia = await exportarCopia()

    expect(await importarCopia(copia, 'reemplazar')).toEqual({ prendas: 0, outfits: 0 })
  })

  it('pone fecha al nombre del fichero', () => {
    expect(nombreFicheroCopia(new Date(2026, 0, 5))).toBe('percha-copia-2026-01-05.zip')
  })
})

describe('la clave de Gemini', () => {
  it('no va en la copia', async () => {
    await sembrar()
    const copia = await exportarCopia()

    const ficheros = unzipSync(new Uint8Array(await copia.arrayBuffer()))
    const manifiesto = strFromU8(ficheros['percha.json'] ?? new Uint8Array())

    expect(manifiesto).not.toContain(CLAVE_FALSA)
    expect(manifiesto).not.toContain('claveGemini')
  })

  it('se conserva al importar, también al reemplazar', async () => {
    await sembrar()
    const copia = await exportarCopia()
    await guardarAjustes({ claveGemini: 'otra-clave-falsa', modeloGemini: 'gemini-viejo' })

    await importarCopia(copia, 'reemplazar')

    expect(await leerAjustes()).toEqual({
      claveGemini: 'otra-clave-falsa',
      modeloGemini: 'gemini-otro',
    })
  })

  it('una copia que trae una clave no la mete', async () => {
    const copia = await retocar(await exportarCopia(), (json) => {
      json.ajustes = { modeloGemini: 'gemini-otro', claveGemini: 'clave-colada' }
    })

    await importarCopia(copia, 'reemplazar')

    expect((await leerAjustes()).claveGemini).toBeNull()
  })
})

describe('copias que no valen', () => {
  async function esperarRechazo(copia: Blob, mensaje: string | RegExp) {
    const antes = await todo()
    const intento = importarCopia(copia, 'reemplazar')

    await expect(intento).rejects.toBeInstanceOf(ErrorCopia)
    await expect(intento).rejects.toThrow(mensaje)
    expect(await todo()).toEqual(antes)
  }

  beforeEach(async () => {
    await sembrar()
  })

  it('un fichero que no es un zip', async () => {
    await esperarRechazo(new Blob(['hola']), MENSAJE_COPIA_DANADA)
  })

  it('un zip sin percha.json', async () => {
    await esperarRechazo(new Blob([zipSync({ 'otra.txt': strToU8('x') })]), MENSAJE_COPIA_DANADA)
  })

  it('un percha.json que no es JSON', async () => {
    await esperarRechazo(
      new Blob([zipSync({ 'percha.json': strToU8('{roto') })]),
      MENSAJE_COPIA_DANADA,
    )
  })

  it('un zip que no es de Percha', async () => {
    const copia = await retocar(await exportarCopia(), (json) => {
      json.formato = 'otra-app'
    })
    await esperarRechazo(copia, MENSAJE_COPIA_DANADA)
  })

  it('una copia de una versión más nueva', async () => {
    const copia = await retocar(await exportarCopia(), (json) => {
      json.version = 2
    })
    await esperarRechazo(copia, /versión más nueva de Percha \(v2\)/)
  })

  it('una copia de una versión que no existe', async () => {
    const copia = await retocar(await exportarCopia(), (json) => {
      json.version = 0
    })
    await esperarRechazo(copia, /no se puede leer \(v0\)/)
  })

  it('una prenda con datos imposibles', async () => {
    const copia = await retocar(await exportarCopia(), (json) => {
      const [prenda] = json.prendas as Record<string, unknown>[]
      if (prenda) prenda.categoria = 'sombrero'
    })
    await esperarRechazo(copia, MENSAJE_COPIA_DANADA)
  })

  it('una prenda con un enlace que no es web', async () => {
    await sembrar()
    const copia = await retocar(await exportarCopia(), (json) => {
      const [prenda] = json.prendas as Record<string, unknown>[]
      if (prenda) prenda.enlace = 'javascript:alert(1)'
    })

    await expect(importarCopia(copia, 'reemplazar')).rejects.toBeInstanceOf(ErrorCopia)
  })

  it('una foto que falta en el zip', async () => {
    const copia = await retocar(await exportarCopia(), () => undefined, ['fotos/1.jpg'])
    await esperarRechazo(copia, MENSAJE_COPIA_DANADA)
  })

  it('una ruta de foto que no es un fichero del zip', async () => {
    const copia = await retocar(await exportarCopia(), (json) => {
      const [prenda] = json.prendas as { fotos: { original: { ruta: string } }[] }[]
      const [foto] = prenda?.fotos ?? []
      if (foto) foto.original.ruta = 'toString'
    })
    await esperarRechazo(copia, MENSAJE_COPIA_DANADA)
  })
})

describe('copias manipuladas que se importan con cuidado', () => {
  it('una foto con un tipo que no es de imagen se guarda como binario', async () => {
    const { camiseta } = await sembrar()
    const copia = await retocar(await exportarCopia(), (json) => {
      for (const prenda of json.prendas as { fotos: { original: { tipo: string } }[] }[]) {
        for (const foto of prenda.fotos) foto.original.tipo = 'text/html'
      }
    })

    await importarCopia(copia, 'reemplazar')

    expect((await leerPrenda(camiseta.id))?.fotos[0]?.original.type).toBe(
      'application/octet-stream',
    )
  })

  it('una prenda repetida cuenta una vez', async () => {
    await sembrar()
    const copia = await retocar(await exportarCopia(), (json) => {
      const prendas = json.prendas as unknown[]
      json.prendas = [...prendas, prendas[0]]
    })

    expect(await importarCopia(copia, 'reemplazar')).toEqual({ prendas: 2, outfits: 1 })
    expect(await db.prendas.count()).toBe(2)
  })

  it('los ficheros que no son de Percha se ignoran', async () => {
    await sembrar()
    const ficheros = unzipSync(new Uint8Array(await (await exportarCopia()).arrayBuffer()))
    ficheros['otra/cosa.bin'] = new Uint8Array(1000)

    expect(await importarCopia(new Blob([zipSync(ficheros)]), 'reemplazar')).toEqual({
      prendas: 2,
      outfits: 1,
    })
  })
})

describe('fusionar el perfil', () => {
  it('no borra con un campo vacío de la copia lo que ya hay en el móvil', async () => {
    await guardarPerfil({ ciudad: 'Valencia' })
    const copia = await exportarCopia()
    await guardarPerfil({ ciudad: 'Bilbao', fotoCara: imagen(9), estilosFavoritos: ['boho'] })

    await importarCopia(copia, 'fusionar')

    expect(await sinBlobs(await leerPerfil())).toEqual({
      fotoCara: await sinBlobs(imagen(9)),
      fotoCuerpo: null,
      ciudad: 'Valencia',
      estilosFavoritos: ['boho'],
    })
  })
})
