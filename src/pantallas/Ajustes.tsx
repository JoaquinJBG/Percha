import { ClaveGemini } from '../componentes/ClaveGemini.tsx'
import { CopiaArmario } from '../componentes/CopiaArmario.tsx'
import { Pantalla } from '../componentes/Pantalla.tsx'

export function Ajustes() {
  return (
    <Pantalla titulo="Ajustes">
      <ClaveGemini />
      <CopiaArmario />
    </Pantalla>
  )
}
