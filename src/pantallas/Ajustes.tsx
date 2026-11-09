import { ClaveGemini } from '../componentes/ClaveGemini.tsx'
import { CopiaArmario } from '../componentes/CopiaArmario.tsx'
import { Pantalla } from '../componentes/Pantalla.tsx'
import { ProbadorPC } from '../componentes/ProbadorPC.tsx'

export function Ajustes() {
  return (
    <Pantalla titulo="Ajustes">
      <ClaveGemini />
      <ProbadorPC />
      <CopiaArmario />
    </Pantalla>
  )
}
