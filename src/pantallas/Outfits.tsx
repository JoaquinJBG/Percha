import { Pantalla } from '../componentes/Pantalla.tsx'
import { TiempoHoy } from '../componentes/TiempoHoy.tsx'

export function Outfits() {
  return (
    <Pantalla titulo="Outfits">
      <p className="text-suave">Aquí aparecerán tus outfits.</p>
      <TiempoHoy />
    </Pantalla>
  )
}
