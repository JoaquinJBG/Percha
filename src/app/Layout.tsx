import { Outlet } from 'react-router'
import { BarraNavegacion } from '../componentes/BarraNavegacion.tsx'

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 bg-papel/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <p className="flex items-center gap-2 font-titulo text-xl font-semibold tracking-tight text-oliva">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 6.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.7" />
            <path d="m12 10.2-8.4 5.6c-.8.5-.4 1.7.5 1.7h15.8c.9 0 1.3-1.2.5-1.7z" />
          </svg>
          Percha
        </p>
      </header>
      <main className="flex-1 px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BarraNavegacion />
    </div>
  )
}
