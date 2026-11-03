import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

interface Destino {
  ruta: string
  etiqueta: string
  icono: ReactNode
}

const destinos: Destino[] = [
  {
    ruta: '/',
    etiqueta: 'Armario',
    icono: (
      <>
        <path d="M10 6.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.7" />
        <path d="m12 10.2-8.4 5.6c-.8.5-.4 1.7.5 1.7h15.8c.9 0 1.3-1.2.5-1.7z" />
      </>
    ),
  },
  {
    ruta: '/outfits',
    etiqueta: 'Outfits',
    icono: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    ruta: '/perfil',
    etiqueta: 'Perfil',
    icono: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-3.6 3.4-6 7-6s6.4 2.4 7 6" />
      </>
    ),
  },
  {
    ruta: '/ajustes',
    etiqueta: 'Ajustes',
    icono: (
      <>
        <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
        <circle cx="15" cy="7" r="2" />
        <circle cx="9" cy="17" r="2" />
      </>
    ),
  },
]

export function BarraNavegacion() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-tinta/10 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {destinos.map(({ ruta, etiqueta, icono }) => (
          <li key={ruta}>
            <NavLink
              to={ruta}
              end
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  isActive ? 'font-semibold text-oliva-oscuro' : 'font-medium text-suave'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-oliva-claro' : ''
                    }`}
                  >
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
                      {icono}
                    </svg>
                  </span>
                  {etiqueta}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
