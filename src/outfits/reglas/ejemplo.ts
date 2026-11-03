// Imprime los 4 outfits del armario de ejemplo en varios días:
// node --experimental-strip-types src/outfits/reglas/ejemplo.ts
import type { Estilo, Ocasion } from '../../datos/modelo.ts'
import type { TiempoHoy } from '../../tiempo/tipos.ts'
import { cuatroOutfits } from './outfits.ts'
import { armarioEjemplo, tiempo } from './pruebas.ts'

const casos: [string, Estilo, Ocasion, TiempoHoy | null][] = [
  ['Trabajo con 8 °C', 'business', 'trabajo', tiempo(8)],
  ['Diario con lluvia y 13 °C', 'casual', 'diario', tiempo(13, { precipitacion: 'lluvia' })],
  ['Cena con 29 °C en julio', 'elegante', 'cena', tiempo(29, { fecha: '2026-07-15' })],
  ['Boda sin tiempo', 'formal', 'boda', null],
]

const armario = armarioEjemplo()
for (const [titulo, estilo, ocasion, hoy] of casos) {
  const { outfits, avisos } = cuatroOutfits({ prendas: armario, estilo, ocasion, tiempo: hoy }, 7)
  console.log(`\n== ${titulo} · ${estilo} · ${ocasion}`)
  outfits.forEach((outfit, i) => {
    const prendas = outfit.prendas.map((p) => p.id).join(' + ')
    console.log(`${String(i + 1)}. ${prendas}\n   ${outfit.motivo}`)
  })
  for (const aviso of avisos) console.log(`   ! ${aviso}`)
}
