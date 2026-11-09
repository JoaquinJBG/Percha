import { describe, expect, it } from 'vitest'
import { leerCompartido, textoComposicion } from './compartido.ts'
import {
  codigoZara,
  datosDeEnlace,
  enlacesDeBusqueda,
  tiendaDeEnlace,
  tiendaDeMarca,
} from './enlaces.ts'

function consulta(url: string | undefined): string | null {
  return url ? new URL(url).searchParams.get('q') : null
}

describe('enlaces de búsqueda', () => {
  it('Zara: la REF de la etiqueta pasa a la forma de su URL', () => {
    expect(codigoZara('4085/021')).toBe('p04085021')
    expect(codigoZara('REF 4085/021/800')).toBe('p04085021')
    expect(codigoZara('00679 / 310')).toBe('p00679310')
    expect(codigoZara('sin código')).toBeNull()

    const [google, imagenes, tienda] = enlacesDeBusqueda({
      marca: 'ZARA',
      referencia: 'REF 4085/021/800',
    })
    expect(consulta(google?.url)).toBe('"p04085021" site:zara.com')
    expect(imagenes?.url).toContain('udm=2')
    expect(consulta(imagenes?.url)).toBe('"p04085021" site:zara.com')
    expect(tienda).toEqual({
      texto: 'En la tienda de Zara',
      url: 'https://www.zara.com/es/es/search?searchTerm=04085021',
    })
  })

  it('H&M: con el número de artículo entero va directo a la ficha', () => {
    const enlaces = enlacesDeBusqueda({ marca: 'H & M', referencia: '0970819 001' })
    expect(consulta(enlaces[0]?.url)).toBe('"0970819001" site:hm.com')
    expect(enlaces[2]?.url).toBe('https://www2.hm.com/es_es/productpage.0970819001.html')

    const sinColor = enlacesDeBusqueda({ marca: 'HM', referencia: '0970819' })
    expect(sinColor[2]?.url).toBe('https://www2.hm.com/es_es/search-results.html?q=0970819')
  })

  it('Nike y Adidas: por su código de estilo', () => {
    const nike = enlacesDeBusqueda({ marca: 'Nike', referencia: 'dd1391-100' })
    expect(consulta(nike[0]?.url)).toBe('"DD1391-100" nike')
    expect(nike[2]?.url).toBe('https://www.nike.com/es/w?q=DD1391-100')

    const adidas = enlacesDeBusqueda({ marca: 'adidas', referencia: 'GZ2000' })
    expect(consulta(adidas[0]?.url)).toBe('"GZ2000" adidas')
    expect(adidas[2]?.url).toBe('https://www.adidas.es/search?q=GZ2000')
  })

  it('otra marca, o una referencia sin la forma esperada: búsqueda genérica sin tienda', () => {
    const mango = enlacesDeBusqueda({ marca: 'Mango', referencia: '87012345' })
    expect(mango).toHaveLength(2)
    expect(consulta(mango[0]?.url)).toBe('Mango "87012345"')

    const zaraRara = enlacesDeBusqueda({ marca: 'Zara', referencia: 'ABC' })
    expect(zaraRara).toHaveLength(2)
    expect(consulta(zaraRara[0]?.url)).toBe('Zara "ABC"')

    expect(consulta(enlacesDeBusqueda({ referencia: 'X-12' })[0]?.url)).toBe('"X-12"')
  })

  it('sin referencia no hay enlaces: con la marca sola no se encuentra la prenda', () => {
    expect(enlacesDeBusqueda({ marca: 'Zara' })).toEqual([])
    expect(enlacesDeBusqueda({ marca: 'Zara', referencia: '   ' })).toEqual([])
  })

  it('las comillas y los símbolos de la referencia van codificados en la URL', () => {
    const [google] = enlacesDeBusqueda({ marca: 'A&B', referencia: 'x"&y' })
    expect(google?.url).not.toContain('&y')
    expect(consulta(google?.url)).toBe('A&B "x"&y"')
  })
})

describe('marca y tienda', () => {
  it('reconoce las marcas aunque se escriban distinto', () => {
    expect(tiendaDeMarca(' zara ')).toBe('zara')
    expect(tiendaDeMarca('H&M')).toBe('hm')
    expect(tiendaDeMarca('adidas Originals')).toBeNull()
    expect(tiendaDeMarca(undefined)).toBeNull()
  })

  it('reconoce la tienda por el dominio, no por un texto que lo contenga', () => {
    expect(tiendaDeEnlace('https://www.zara.com/es/es/x-p04085021.html')).toBe('zara')
    expect(tiendaDeEnlace('https://www2.hm.com/es_es/productpage.0970819001.html')).toBe('hm')
    expect(tiendaDeEnlace('https://www.adidas.es/zapatilla/GZ2000.html')).toBe('adidas')
    expect(tiendaDeEnlace('https://zara.com.estafa.example/')).toBeNull()
    expect(tiendaDeEnlace('https://notzara.com/')).toBeNull()
    expect(tiendaDeEnlace('no es un enlace')).toBeNull()
  })

  it('saca la marca y la referencia de la URL de la ficha', () => {
    expect(datosDeEnlace('https://www.zara.com/es/es/camiseta-basica-p04085021.html?v1=1')).toEqual(
      { marca: 'Zara', referencia: '4085/021' },
    )
    expect(datosDeEnlace('https://www2.hm.com/es_es/productpage.0970819001.html')).toEqual({
      marca: 'H&M',
      referencia: '0970819001',
    })
    expect(
      datosDeEnlace('https://www.nike.com/es/t/air-force-1-07-zapatillas-abc/DD8959-100'),
    ).toEqual({ marca: 'Nike', referencia: 'DD8959-100' })
    expect(datosDeEnlace('https://www.adidas.es/zapatilla-samba-og/B75806.html')).toEqual({
      marca: 'Adidas',
      referencia: 'B75806',
    })
    expect(datosDeEnlace('https://www.zara.com/es/')).toEqual({ marca: 'Zara' })
    expect(datosDeEnlace('https://www.mango.com/x')).toEqual({})
  })
})

describe('lo compartido desde otra app', () => {
  it('coge el enlace de `url` y el título', () => {
    expect(
      leerCompartido(
        new URLSearchParams({ url: 'https://www.zara.com/x-p04085021.html', title: 'CAMISETA' }),
      ),
    ).toEqual({ enlace: 'https://www.zara.com/x-p04085021.html', titulo: 'CAMISETA' })
  })

  it('si el enlace viene dentro del texto, lo saca y deja el resto como título', () => {
    expect(
      leerCompartido(
        new URLSearchParams({
          text: 'Mira esto en ZARA: https://www.zara.com/es/es/x-p04085021.html.',
        }),
      ),
    ).toEqual({
      enlace: 'https://www.zara.com/es/es/x-p04085021.html',
      titulo: 'Mira esto en ZARA:',
    })
  })

  it('sin enlace web no hay enlace (ni javascript: ni texto suelto)', () => {
    expect(leerCompartido(new URLSearchParams({ url: 'javascript:alert(1)' })).enlace).toBeNull()
    expect(leerCompartido(new URLSearchParams({ text: 'una camiseta' }))).toEqual({
      enlace: null,
      titulo: 'una camiseta',
    })
    expect(leerCompartido(new URLSearchParams())).toEqual({ enlace: null, titulo: '' })
  })
})

describe('textoComposicion', () => {
  it('pone el porcentaje si lo hay', () => {
    expect(
      textoComposicion([{ material: 'algodón', porcentaje: 95 }, { material: 'elastano' }]),
    ).toBe('95 % algodón, elastano')
    expect(textoComposicion([{ material: 'elastano', porcentaje: 2.5 }])).toBe('2,5 % elastano')
    expect(textoComposicion(undefined)).toBe('')
  })
})
