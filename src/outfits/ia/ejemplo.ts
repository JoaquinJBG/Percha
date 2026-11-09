// Imprime los 4 outfits del armario de ejemplo con el proveedor falso (sin red ni clave):
// node --experimental-strip-types src/outfits/ia/ejemplo.ts
import { ErrorIA } from '../../ia/errores.ts'
import { crearProveedorFalso, outfitsDePrueba } from '../../ia/falso.ts'
import type { ProveedorIA } from '../../ia/tipos.ts'
import type { Peticion } from '../reglas/index.ts'
import { armarioEjemplo, tiempo } from '../reglas/pruebas.ts'
import { elegirOutfitsConIA } from './elegir.ts'

const trabajoConLluvia: Peticion = {
  prendas: armarioEjemplo(),
  estilo: 'business',
  ocasion: 'trabajo',
  tiempo: tiempo(8, { precipitacion: 'lluvia' }),
}
const diarioTemplado: Peticion = {
  prendas: armarioEjemplo(),
  estilo: 'casual',
  ocasion: 'diario',
  tiempo: tiempo(19),
}

const casos: [string, Peticion, ProveedorIA][] = [
  ['IA que responde bien · trabajo · 8 °C con lluvia', trabajoConLluvia, crearProveedorFalso()],
  [
    'IA que se inventa una prenda en el primero · trabajo · 8 °C con lluvia',
    trabajoConLluvia,
    crearProveedorFalso({
      outfits: (peticion) =>
        outfitsDePrueba(peticion).map((o, i) =>
          i === 0 ? { ...o, prendas: [...o.prendas, 'prenda-inventada'] } : o,
        ),
    }),
  ],
  [
    'IA sin cupo (429) · trabajo · 8 °C con lluvia',
    trabajoConLluvia,
    crearProveedorFalso({ error: new ErrorIA('sin-cupo', { estado: 429 }) }),
  ],
  ['Tercera pieza opcional · diario · 19 °C', diarioTemplado, crearProveedorFalso()],
]

for (const [titulo, peticion, proveedor] of casos) {
  const { outfits, avisos, errorIA } = await elegirOutfitsConIA(peticion, 7, { proveedor })
  console.log(`
== ${titulo} · errorIA: ${String(errorIA)}`)
  outfits.forEach((outfit, i) => {
    const prendas = outfit.prendas.map((p) => p.id).join(' + ')
    console.log(`${String(i + 1)}. [${outfit.origen}] ${prendas}
   ${outfit.motivo}`)
  })
  for (const aviso of avisos) console.log(`   ! ${aviso}`)
}
