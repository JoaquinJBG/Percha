import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { pedirAlmacenamientoPersistente } from './datos/db.ts'
import './index.css'

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el elemento #root')

void pedirAlmacenamientoPersistente()

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
