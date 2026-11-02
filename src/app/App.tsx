import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { rutas } from './rutas.tsx'

const router = createBrowserRouter(rutas)

export function App() {
  return <RouterProvider router={router} />
}
