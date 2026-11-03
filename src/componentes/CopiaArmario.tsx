import { useRef, useState } from 'react'
import {
  ErrorCopia,
  exportarCopia,
  importarCopia,
  nombreFicheroCopia,
  type ModoImportar,
} from '../datos/copia.ts'

type Estado =
  | { fase: 'libre' }
  | { fase: 'ocupada'; texto: string }
  | { fase: 'elegirModo'; fichero: File }
  | { fase: 'hecho'; texto: string }
  | { fase: 'error'; texto: string }

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta'
const botonPrincipal = `${boton} bg-tinta text-papel`
const botonSecundario = `${boton} border border-tinta/25 text-tinta`

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  // Si se revoca en el acto, Chrome en Android puede cortar la descarga.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}

function contar(n: number, singular: string, plural: string) {
  return `${String(n)} ${n === 1 ? singular : plural}`
}

export function CopiaArmario() {
  const [estado, setEstado] = useState<Estado>({ fase: 'libre' })
  const selector = useRef<HTMLInputElement>(null)
  const ocupada = estado.fase === 'ocupada'

  async function exportar() {
    setEstado({ fase: 'ocupada', texto: 'Preparando la copia…' })
    try {
      descargar(await exportarCopia(), nombreFicheroCopia())
      setEstado({ fase: 'hecho', texto: 'Copia descargada.' })
    } catch (error) {
      console.error(error)
      setEstado({ fase: 'error', texto: 'No se pudo preparar la copia.' })
    }
  }

  async function importar(fichero: File, modo: ModoImportar) {
    setEstado({ fase: 'ocupada', texto: 'Importando la copia…' })
    try {
      const { prendas, outfits } = await importarCopia(fichero, modo)
      setEstado({
        fase: 'hecho',
        texto: `Copia importada: ${contar(prendas, 'prenda', 'prendas')} y ${contar(outfits, 'outfit', 'outfits')}.`,
      })
    } catch (error) {
      if (!(error instanceof ErrorCopia)) console.error(error)
      setEstado({
        fase: 'error',
        texto: error instanceof ErrorCopia ? error.message : 'No se pudo importar la copia.',
      })
    }
  }

  return (
    <section aria-labelledby="titulo-copia" className="flex flex-col gap-3">
      <h2 id="titulo-copia" className="text-lg font-semibold">
        Copia del armario
      </h2>
      <p className="text-sm text-suave">
        Guarda tus prendas, outfits y perfil en un fichero. La clave de Gemini no va en la copia.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={botonPrincipal}
          disabled={ocupada}
          onClick={() => void exportar()}
        >
          Exportar copia
        </button>
        <button
          type="button"
          className={botonSecundario}
          disabled={ocupada}
          onClick={() => selector.current?.click()}
        >
          Importar copia
        </button>
      </div>
      <input
        ref={selector}
        type="file"
        aria-label="Fichero de copia"
        className="hidden"
        onChange={(evento) => {
          const fichero = evento.target.files?.[0]
          evento.target.value = ''
          if (fichero) setEstado({ fase: 'elegirModo', fichero })
        }}
      />

      {estado.fase === 'elegirModo' && (
        <div
          role="group"
          aria-labelledby="titulo-modo"
          className="flex flex-col gap-3 rounded-2xl border border-tinta/15 bg-white/60 p-4"
        >
          <p id="titulo-modo" className="font-medium break-words">
            ¿Cómo importas «{estado.fichero.name}»?
          </p>
          <button
            type="button"
            className={botonPrincipal}
            onClick={() => void importar(estado.fichero, 'fusionar')}
          >
            Fusionar con lo que tengo
          </button>
          <p className="-mt-1 text-sm text-suave">
            Añade lo de la copia. Si algo ya está, se queda la versión de la copia; lo que falte en
            ella no se borra.
          </p>
          <button
            type="button"
            className={botonSecundario}
            onClick={() => void importar(estado.fichero, 'reemplazar')}
          >
            Reemplazar todo
          </button>
          <p className="-mt-1 text-sm text-suave">
            Borra tus prendas, outfits y perfil de este móvil y pone los de la copia.
          </p>
          <button
            type="button"
            className="min-h-12 text-suave underline"
            onClick={() => {
              setEstado({ fase: 'libre' })
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {(estado.fase === 'ocupada' || estado.fase === 'hecho') && (
        <p role="status" className="text-sm">
          {estado.texto}
        </p>
      )}
      {estado.fase === 'error' && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {estado.texto}
        </p>
      )}
    </section>
  )
}
