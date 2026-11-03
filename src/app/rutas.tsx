import { Navigate, type RouteObject } from 'react-router'
import { Ajustes } from '../pantallas/Ajustes.tsx'
import { Armario } from '../pantallas/armario/Armario.tsx'
import { Outfits } from '../pantallas/Outfits.tsx'
import { Perfil } from '../pantallas/Perfil.tsx'
import { Layout } from './Layout.tsx'

export const rutas: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Armario /> },
      { path: 'outfits', element: <Outfits /> },
      { path: 'perfil', element: <Perfil /> },
      { path: 'ajustes', element: <Ajustes /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
