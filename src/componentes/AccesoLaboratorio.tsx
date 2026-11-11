import { useRef, useState } from 'react'
import { Link } from 'react-router'

const CLAVE_VISIBLE = 'percha:laboratorio'
const TOQUES = 5
/** Los 5 toques tienen que caer seguidos: así no se abre por tocar de vez en cuando. */
const VENTANA_MS = 3000

function leerVisible(): boolean {
  try {
    return localStorage.getItem(CLAVE_VISIBLE) === '1'
  } catch {
    return false
  }
}

/**
 * Pie de Ajustes. Cinco toques seguidos en «Percha» enseñan el enlace al Laboratorio (S9); se queda
 * visible en este móvil hasta «Ocultar».
 */
export function AccesoLaboratorio() {
  const [visible, setVisible] = useState(leerVisible)
  const toques = useRef<number[]>([])

  function cambiar(valor: boolean) {
    setVisible(valor)
    try {
      if (valor) localStorage.setItem(CLAVE_VISIBLE, '1')
      else localStorage.removeItem(CLAVE_VISIBLE)
    } catch {
      // Sin almacenamiento, vale solo mientras siga abierta la pantalla.
    }
  }

  function tocar() {
    const ahora = Date.now()
    toques.current = [...toques.current, ahora].filter((t) => ahora - t < VENTANA_MS)
    if (toques.current.length >= TOQUES) {
      toques.current = []
      cambiar(true)
    }
  }

  return (
    <footer className="flex flex-col items-center gap-2 pt-4 text-sm text-suave">
      {/* Sin pinta de botón a propósito: es un acceso escondido. */}
      <p onClick={tocar} className="select-none">
        Percha · tus datos se quedan en este móvil
      </p>
      {visible && (
        <p className="flex gap-4">
          <Link to="/laboratorio" className="font-medium text-oliva underline underline-offset-2">
            Laboratorio
          </Link>
          <button
            type="button"
            className="underline"
            onClick={() => {
              cambiar(false)
            }}
          >
            Ocultar
          </button>
        </p>
      )}
    </footer>
  )
}
