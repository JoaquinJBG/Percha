import type { DatosEtiqueta } from '../datos/modelo.ts'

/** Las marcas cuya referencia sabemos convertir en una búsqueda precisa (S4 §3). */
export type Tienda = 'zara' | 'hm' | 'nike' | 'adidas'

export const NOMBRE_TIENDA: Record<Tienda, string> = {
  zara: 'Zara',
  hm: 'H&M',
  nike: 'Nike',
  adidas: 'Adidas',
}

export interface EnlaceBusqueda {
  /** Texto del botón. */
  texto: string
  url: string
}

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function tiendaDeMarca(marca: string | undefined): Tienda | null {
  const clave = sinAcentos(marca ?? '')
    .toLowerCase()
    .replace(/\s+|\.|-/g, '')
  if (clave === 'zara') return 'zara'
  if (clave === 'h&m' || clave === 'hm' || clave === 'handm' || clave === 'hennesmauritz')
    return 'hm'
  if (clave === 'nike') return 'nike'
  if (clave === 'adidas') return 'adidas'
  return null
}

/** Por el dominio de un enlace compartido: `www.zara.com` → Zara. No se descarga nada. */
export function tiendaDeEnlace(enlace: string): Tienda | null {
  let host: string
  try {
    host = new URL(enlace).hostname.toLowerCase()
  } catch {
    return null
  }
  const es = (dominio: string) => host === dominio || host.endsWith(`.${dominio}`)
  if (es('zara.com')) return 'zara'
  if (es('hm.com')) return 'hm'
  if (es('nike.com')) return 'nike'
  if (/(^|\.)adidas\.[a-z.]+$/.test(host)) return 'adidas'
  return null
}

/** «REF 4085/021/800» → `p04085021`, como sale en la URL de la ficha de Zara. */
export function codigoZara(referencia: string): string | null {
  const partes = /(\d{3,5})\s*\/\s*(\d{3})/.exec(referencia)
  if (!partes?.[1] || !partes[2]) return null
  return `p${partes[1].padStart(5, '0')}${partes[2]}`
}

/** El número de artículo de H&M: 10 cifras (7 del modelo y 3 del color), o 7 si falta el color. */
export function codigoHM(referencia: string): string | null {
  const cifras = referencia.replace(/\D/g, '')
  return cifras.length === 10 || cifras.length === 7 ? cifras : null
}

/** Código de estilo de Nike: `DD1391-100`. */
export function codigoNike(referencia: string): string | null {
  const codigo = referencia.toUpperCase().replace(/\s+/g, '')
  return /^[A-Z0-9]{6}-\d{3}$/.test(codigo) ? codigo : null
}

/** Código de artículo de Adidas: `GZ2000`, `H03740`, `IF1234`. */
export function codigoAdidas(referencia: string): string | null {
  const codigo = referencia.toUpperCase().replace(/\s+/g, '')
  return /^[A-Z]{1,2}\d{4,5}$/.test(codigo) ? codigo : null
}

function google(consulta: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(consulta)}`
}

function googleImagenes(consulta: string): string {
  return `https://www.google.com/search?udm=2&q=${encodeURIComponent(consulta)}`
}

interface Busqueda {
  consulta: string
  tienda?: string
}

function busquedaDeTienda(tienda: Tienda, referencia: string): Busqueda | null {
  switch (tienda) {
    case 'zara': {
      const codigo = codigoZara(referencia)
      return codigo
        ? {
            consulta: `"${codigo}" site:zara.com`,
            tienda: `https://www.zara.com/es/es/search?searchTerm=${codigo.slice(1)}`,
          }
        : null
    }
    case 'hm': {
      const codigo = codigoHM(referencia)
      if (!codigo) return null
      return {
        consulta: `"${codigo}" site:hm.com`,
        tienda:
          codigo.length === 10
            ? `https://www2.hm.com/es_es/productpage.${codigo}.html`
            : `https://www2.hm.com/es_es/search-results.html?q=${codigo}`,
      }
    }
    case 'nike': {
      const codigo = codigoNike(referencia)
      return codigo
        ? { consulta: `"${codigo}" nike`, tienda: `https://www.nike.com/es/w?q=${codigo}` }
        : null
    }
    case 'adidas': {
      const codigo = codigoAdidas(referencia)
      return codigo
        ? { consulta: `"${codigo}" adidas`, tienda: `https://www.adidas.es/search?q=${codigo}` }
        : null
    }
  }
}

/**
 * «Buscar en Google», «Google Imágenes» y, si la marca es conocida y la referencia tiene su forma,
 * «En la tienda». Son enlaces que abre el usuario: Percha nunca llama a una tienda (D17).
 */
export function enlacesDeBusqueda({
  marca,
  referencia,
}: Pick<DatosEtiqueta, 'marca' | 'referencia'>): EnlaceBusqueda[] {
  const marcaLimpia = marca?.trim() ?? ''
  const referenciaLimpia = referencia?.trim() ?? ''
  if (!referenciaLimpia) {
    // Solo con la marca no se encuentra una prenda concreta.
    return []
  }
  const tienda = tiendaDeMarca(marcaLimpia)
  const precisa = tienda ? busquedaDeTienda(tienda, referenciaLimpia) : null
  const consulta =
    precisa?.consulta ?? [marcaLimpia, `"${referenciaLimpia}"`].filter(Boolean).join(' ')
  const enlaces: EnlaceBusqueda[] = [
    { texto: 'Buscar en Google', url: google(consulta) },
    { texto: 'Google Imágenes', url: googleImagenes(consulta) },
  ]
  if (tienda && precisa?.tienda) {
    enlaces.push({ texto: `En la tienda de ${NOMBRE_TIENDA[tienda]}`, url: precisa.tienda })
  }
  return enlaces
}

/** Lo que se puede sacar de la URL de una ficha sin abrirla: la marca y, a veces, la referencia. */
export function datosDeEnlace(enlace: string): Pick<DatosEtiqueta, 'marca' | 'referencia'> {
  const tienda = tiendaDeEnlace(enlace)
  if (!tienda) return {}
  const marca = NOMBRE_TIENDA[tienda]
  let ruta: string
  try {
    ruta = new URL(enlace).pathname
  } catch {
    return { marca }
  }
  const sacar = (patron: RegExp) => patron.exec(ruta)?.[1]
  let referencia: string | undefined
  if (tienda === 'zara') {
    const codigo = sacar(/-p(\d{8})\.html$/)
    if (codigo) referencia = `${String(Number(codigo.slice(0, 5)))}/${codigo.slice(5)}`
  } else if (tienda === 'hm') {
    referencia = sacar(/productpage\.(\d{10})\.html$/)
  } else if (tienda === 'nike') {
    referencia = sacar(/\/([A-Z0-9]{6}-\d{3})(?:\/|$)/)
  } else {
    referencia = sacar(/\/([A-Z]{1,2}\d{4,5})\.html$/)
  }
  return referencia ? { marca, referencia } : { marca }
}
