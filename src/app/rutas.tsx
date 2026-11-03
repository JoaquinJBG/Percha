import { Navigate, type RouteObject } from 'react-router'
import { Ajustes } from '../pantallas/Ajustes.tsx'
import { Armario } from '../pantallas/armario/Armario.tsx'
import { NuevaPrenda } from '../pantallas/nueva-prenda/NuevaPrenda.tsx'
import { Outfits } from '../pantallas/outfits/Outfits.tsx'
import { Perfil } from '../pantallas/perfil/Perfil.tsx'
import { Layout } from './Layout.tsx'

export const rutas: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Armario /> },
      { path: 'prendas/nueva', element: <NuevaPrenda /> },
      { path: 'outfits', element: <Outfits /> },
      { path: 'perfil', element: <Perfil /> },
      { path: 'ajustes', element: <Ajustes /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
