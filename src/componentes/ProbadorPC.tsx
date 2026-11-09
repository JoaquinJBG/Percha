import { useEffect, useState, type SubmitEvent } from 'react'
import type { Ajustes } from '../datos/modelo.ts'
import { guardarAjustes, leerAjustes } from '../datos/repositorio.ts'
import {
  baseProbador,
  comprobarUrlProbador,
  crearClienteProbador,
  type ConfigProbador,
  type SaludProbador,
} from '../probador/index.ts'
import { mensajeProbador } from '../probador/mensajes.ts'

interface Props {
  comprobar?: (config: ConfigProbador) => Promise<SaludProbador>
}

type Aviso = { tipo: 'bien' | 'error'; texto: string } | null

export const GUIA_PROBADOR = 'https://github.com/JoaquinJBG/Percha/blob/main/docs/probador-pc.md'

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonPrincipal = `${boton} bg-oliva text-papel`
const botonSecundario = `${boton} border border-tinta/25 text-tinta`
const campo =
  'min-h-12 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva'

function comprobarConRed(config: ConfigProbador): Promise<SaludProbador> {
  return crearClienteProbador(config).salud()
}

function textoSalud(salud: SaludProbador): string {
  return salud.ocupado
    ? 'Tu PC responde, pero ahora está con otra prueba.'
    : 'Tu PC responde y está listo para probar.'
}

/**
 * Ajustes del probador del PC (T7.1, D19): la URL de Tailscale Serve y la clave que enseña el servidor.
 * Se guardan solo en este móvil. Sin ellas, «Pruébatelo» va a Gemini como siempre.
 */
export function ProbadorPC({ comprobar = comprobarConRed }: Props) {
  const [ajustes, setAjustes] = useState<Ajustes | null>(null)
  const [url, setUrl] = useState('')
  const [clave, setClave] = useState('')
  const [espera, setEspera] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const ocupada = espera !== null
  const guardado =
    ajustes?.urlProbador && ajustes.claveProbador
      ? { url: ajustes.urlProbador, clave: ajustes.claveProbador }
      : null

  useEffect(() => {
    let vigente = true
    leerAjustes().then(
      (leidos) => {
        if (!vigente) return
        setAjustes(leidos)
        setUrl(leidos.urlProbador ?? '')
      },
      () => {
        if (vigente) setAviso({ tipo: 'error', texto: 'No se han podido leer los ajustes.' })
      },
    )
    return () => {
      vigente = false
    }
  }, [])

  async function ocupar(textoEspera: string, tarea: () => Promise<void>) {
    setEspera(textoEspera)
    setAviso(null)
    try {
      await tarea()
    } finally {
      setEspera(null)
    }
  }

  async function probarConexion(config: ConfigProbador, prefijo = '') {
    try {
      setAviso({ tipo: 'bien', texto: `${prefijo}${textoSalud(await comprobar(config))}` })
    } catch (fallo) {
      setAviso({ tipo: 'error', texto: `${prefijo}${mensajeProbador(fallo)}` })
    }
  }

  function guardar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!ajustes) return
    const problemaUrl = comprobarUrlProbador(url)
    if (problemaUrl) {
      setAviso({ tipo: 'error', texto: problemaUrl })
      return
    }
    const nuevaClave = clave.trim() || guardado?.clave
    if (!nuevaClave) {
      setAviso({ tipo: 'error', texto: 'Pega la clave que enseña el probador en tu PC.' })
      return
    }
    // Un espacio invisible al copiar haría fallar la cabecera HTTP.
    if (!/^[!-~]+$/.test(nuevaClave)) {
      setAviso({
        tipo: 'error',
        texto: 'La clave lleva espacios o caracteres raros. Cópiala otra vez de la consola.',
      })
      return
    }
    const config = { url: baseProbador(url), clave: nuevaClave }
    void ocupar('Comprobando tu PC…', async () => {
      try {
        setAjustes(await guardarAjustes({ urlProbador: config.url, claveProbador: config.clave }))
      } catch {
        setAviso({ tipo: 'error', texto: 'No se ha podido guardar.' })
        return
      }
      setClave('')
      setUrl(config.url)
      // Se guarda aunque el PC no responda: puede estar apagado ahora.
      await probarConexion(config, 'Guardado. ')
    })
  }

  function comprobarGuardado() {
    if (!guardado) return
    void ocupar('Comprobando tu PC…', () => probarConexion(guardado))
  }

  function quitar() {
    void ocupar('Quitando el probador…', async () => {
      try {
        setAjustes(await guardarAjustes({ urlProbador: null, claveProbador: null }))
        setUrl('')
        setClave('')
        setAviso({ tipo: 'bien', texto: 'Quitado: «Pruébatelo» vuelve a usar Gemini.' })
      } catch {
        setAviso({ tipo: 'error', texto: 'No se ha podido quitar.' })
      }
    })
  }

  return (
    <section aria-labelledby="titulo-probador" className="flex flex-col gap-3">
      <h2 id="titulo-probador" className="font-titulo text-xl font-semibold">
        Probador en tu PC
      </h2>
      <p className="text-sm text-suave">
        Opcional. Si tienes el probador instalado en tu PC, «Pruébatelo» te viste allí y las fotos
        no salen de tus aparatos. Si no responde, puedes seguir usando Gemini.{' '}
        <a
          href={GUIA_PROBADOR}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-2"
        >
          Cómo se instala
        </a>
      </p>

      {guardado && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-tarjeta">
          <p className="font-medium break-all">Probador: {guardado.url}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={botonSecundario}
              disabled={ocupada}
              onClick={comprobarGuardado}
            >
              Comprobar
            </button>
            <button type="button" className={botonSecundario} disabled={ocupada} onClick={quitar}>
              Quitar
            </button>
          </div>
        </div>
      )}

      <form noValidate className="flex flex-col gap-3" onSubmit={guardar}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Dirección del probador</span>
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(evento) => {
              setUrl(evento.target.value)
            }}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://tu-pc.tu-red.ts.net"
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {guardado ? 'Cambiar la clave (déjala vacía para seguir con la de ahora)' : 'Clave'}
          </span>
          <input
            type="password"
            value={clave}
            onChange={(evento) => {
              setClave(evento.target.value)
            }}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="La que enseña el probador en su consola"
            className={campo}
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
    </section>
  )
}
