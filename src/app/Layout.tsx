import { Outlet } from 'react-router'
import { BarraNavegacion } from '../componentes/BarraNavegacion.tsx'

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BarraNavegacion />
    </div>
  )
}
