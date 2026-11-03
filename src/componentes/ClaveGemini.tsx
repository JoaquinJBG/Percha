import { useEffect, useState, type SubmitEvent } from 'react'
import type { Ajustes } from '../datos/modelo.ts'
import { guardarAjustes, leerAjustes } from '../datos/repositorio.ts'
import { crearProveedorGemini, ErrorIA, type ProveedorIA } from '../ia/index.ts'

interface Props {
  crearProveedor?: (clave: string, modelo: string) => ProveedorIA
}

type Aviso = { tipo: 'bien' | 'error'; texto: string } | null

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonPrincipal = `${boton} bg-oliva text-papel`
const botonSecundario = `${boton} border border-tinta/25 text-tinta`
const enlace = 'font-medium underline underline-offset-2'

function proveedorGemini(clave: string, modelo: string): ProveedorIA {
  return crearProveedorGemini({ clave, modelo })
}

function comoErrorIA(error: unknown): ErrorIA {
  return error instanceof ErrorIA ? error : new ErrorIA('otro')
}

export function ClaveGemini({ crearProveedor = proveedorGemini }: Props) {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null)
  const [texto, setTexto] = useState('')
  // Qué se está haciendo, o `null` si nada.
  const [espera, setEspera] = useState<string | null>(null)
  const ocupada = espera !== null
  const [aviso, setAviso] = useState<Aviso>(null)
  const guardada = ajustes?.claveGemini ?? null

  useEffect(() => {
    let vigente = true
    leerAjustes().then(
      (leidos) => {
        if (vigente) setAjustes(leidos)
      },
      () => {
        if (vigente) setAviso({ tipo: 'error', texto: 'No se han podido leer los ajustes.' })
      },
    )
    return () => {
      vigente = false
    }
  }, [])

  // Se relee por si otra parte de Ajustes (importar una copia) ha cambiado el modelo.
  async function modeloActual(): Promise<string> {
    return (await leerAjustes()).modeloGemini
  }

  async function ocupar(textoEspera: string, tarea: () => Promise<void>) {
    setEspera(textoEspera)
    setAviso(null)
    try {
      await tarea()
    } finally {
      setEspera(null)
    }
  }

  function guardar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    const clave = texto.trim()
    if (!ajustes) return
    if (!clave) {
      setAviso({ tipo: 'error', texto: 'Pega la clave primero.' })
      return
    }
    // Un espacio invisible o una comilla tipográfica al copiar harían fallar la cabecera HTTP.
    if (!/^[!-~]+$/.test(clave)) {
      setAviso({
        tipo: 'error',
        texto: 'La clave lleva espacios o caracteres raros. Cópiala otra vez de AI Studio.',
      })
      return
    }
    void ocupar('Comprobando la clave con Gemini…', async () => {
      let fallo: ErrorIA | null = null
      try {
        await crearProveedor(clave, await modeloActual()).comprobarClave()
      } catch (error) {
        fallo = comoErrorIA(error)
      }
      // Solo se descarta si Google la rechaza; sin red o sin cupo no se sabe si vale.
      if (fallo?.tipo === 'clave-mala') {
        setAviso({ tipo: 'error', texto: fallo.message })
        return
      }
      try {
        setAjustes(await guardarAjustes({ claveGemini: clave }))
      } catch {
        setAviso({ tipo: 'error', texto: 'No se ha podido guardar la clave.' })
        return
      }
      setTexto('')
      setAviso(
        fallo
          ? { tipo: 'error', texto: `Clave guardada, pero sin comprobar. ${fallo.message}` }
          : { tipo: 'bien', texto: 'Clave guardada. Gemini la acepta.' },
      )
    })
  }

  function comprobar() {
    if (!ajustes || !guardada) return
    void ocupar('Comprobando la clave con Gemini…', async () => {
      try {
        await crearProveedor(guardada, await modeloActual()).comprobarClave()
        setAviso({ tipo: 'bien', texto: 'Gemini acepta tu clave.' })
      } catch (error) {
        setAviso({ tipo: 'error', texto: comoErrorIA(error).message })
      }
    })
  }

  function olvidar() {
    void ocupar('Borrando la clave…', async () => {
      try {
        setAjustes(await guardarAjustes({ claveGemini: null }))
        setAviso({ tipo: 'bien', texto: 'Clave olvidada: ya no está en este móvil.' })
      } catch {
        setAviso({ tipo: 'error', texto: 'No se ha podido borrar la clave.' })
      }
    })
  }

  return (
    <section aria-labelledby="titulo-clave" className="flex flex-col gap-3">
      <h2 id="titulo-clave" className="font-titulo text-xl font-semibold">
        Clave de Gemini
      </h2>
      <p className="text-sm text-suave">
        Percha usa tu propia clave para etiquetar las prendas con IA. Se guarda solo en este móvil y
        no va en la copia.
      </p>

      {guardada && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white shadow-tarjeta p-4">
          <p className="font-medium">Tienes una clave guardada.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={botonSecundario}
              disabled={ocupada}
              onClick={comprobar}
            >
              Comprobar
            </button>
            <button type="button" className={botonSecundario} disabled={ocupada} onClick={olvidar}>
              Olvidar
            </button>
          </div>
        </div>
      )}

      <form className="flex flex-col gap-3" onSubmit={guardar}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{guardada ? 'Cambiar la clave' : 'Tu clave'}</span>
          <input
            type="password"
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value)
            }}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Pega aquí tu clave"
            className="min-h-12 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva"
          />
        </label>
        <button type="submit" className={botonPrincipal} disabled={ocupada || !ajustes}>
          Guardar y comprobar
        </button>
      </form>

      {espera && (
        <p role="status" className="text-sm">
          {espera}
        </p>
      )}
      {aviso?.tipo === 'bien' && (
        <p role="status" className="text-sm">
          {aviso.texto}
        </p>
      )}
      {aviso?.tipo === 'error' && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {aviso.texto}
        </p>
      )}

      <details className="text-sm">
        <summary className="min-h-12 cursor-pointer content-center font-medium">
          ¿Cómo la consigo gratis?
        </summary>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-suave">
          <li>
            Entra en{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className={enlace}
            >
              Google AI Studio
            </a>{' '}
            con tu cuenta de Google.
          </li>
          <li>Pulsa «Create API key» y deja que cree un proyecto nuevo.</li>
          <li>No actives la facturación: así es gratis y no te pueden cobrar.</li>
          <li>Copia la clave y pégala aquí. No se la pases a nadie.</li>
        </ol>
        <p className="mt-2 text-suave">
          Con la clave gratis, Google puede usar las fotos que envías para mejorar sus productos.
        </p>
      </details>
    </section>
  )
}
