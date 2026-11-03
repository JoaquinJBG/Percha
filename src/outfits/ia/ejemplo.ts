// Imprime los 4 outfits del armario de ejemplo con el proveedor falso (sin red ni clave):
// node --experimental-strip-types src/outfits/ia/ejemplo.ts
import { ErrorIA } from '../../ia/errores.ts'
import { crearProveedorFalso, outfitsDePrueba } from '../../ia/falso.ts'
import type { ProveedorIA } from '../../ia/tipos.ts'
import { armarioEjemplo, tiempo } from '../reglas/pruebas.ts'
import { elegirOutfitsConIA } from './elegir.ts'

const casos: [string, ProveedorIA][] = [
  ['IA que responde bien', crearProveedorFalso()],
  [
    'IA que se inventa una prenda en el primero',
    crearProveedorFalso({
      outfits: (peticion) =>
        outfitsDePrueba(peticion).map((o, i) =>
          i === 0 ? { ...o, prendas: [...o.prendas, 'prenda-inventada'] } : o,
        ),
    }),
  ],
  ['IA sin cupo (429)', crearProveedorFalso({ error: new ErrorIA('sin-cupo', { estado: 429 }) })],
]

const peticion = {
  prendas: armarioEjemplo(),
  estilo: 'business',
  ocasion: 'trabajo',
  tiempo: tiempo(8, { precipitacion: 'lluvia' }),
} as const

for (const [titulo, proveedor] of casos) {
  const { outfits, avisos, errorIA } = await elegirOutfitsConIA(peticion, 7, { proveedor })
  console.log(`\n== ${titulo} · business · trabajo · 8 °C con lluvia · errorIA: ${String(errorIA)}`)
  outfits.forEach((outfit, i) => {
    const prendas = outfit.prendas.map((p) => p.id).join(' + ')
    console.log(`${String(i + 1)}. [${outfit.origen}] ${prendas}\n   ${outfit.motivo}`)
  })
  for (const aviso of avisos) console.log(`   ! ${aviso}`)
}
