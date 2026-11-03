import { Link } from 'react-router'
import { Pantalla } from '../componentes/Pantalla.tsx'

export function Armario() {
  return (
    <Pantalla titulo="Armario">
      <Link
        to="/prendas/nueva"
        className="flex min-h-12 items-center justify-center rounded-xl bg-tinta px-4 font-medium text-papel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
      >
        Añadir prenda
      </Link>
      <p className="text-suave">Aquí verás tus prendas.</p>
    </Pantalla>
  )
}
