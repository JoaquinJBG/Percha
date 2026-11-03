import { useEffect, useState, type SubmitEvent } from 'react'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import { ESTILOS, type Estilo, type Perfil as DatosPerfil } from '../../datos/modelo.ts'
import { guardarPerfil, leerPerfil } from '../../datos/repositorio.ts'
import { ErrorFoto, normalizarFoto } from '../../recorte/index.ts'
import { FotoPerfil } from './FotoPerfil.tsx'

interface Props {
  leer?: () => Promise<DatosPerfil>
  guardar?: (cambios: Partial<DatosPerfil>) => Promise<DatosPerfil>
  normalizar?: (foto: Blob) => Promise<Blob>
}

type CampoFoto = 'fotoCuerpo' | 'fotoCara'
type Seccion = 'fotos' | 'ciudad' | 'estilos'
type Aviso = { seccion: Seccion; tipo: 'bien' | 'error'; texto: string } | null

const NOMBRE_FOTO: Record<CampoFoto, string> = {
  fotoCuerpo: 'de cuerpo entero',
  fotoCara: 'de cara',
}

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta'
const botonPrincipal = `${boton} bg-tinta text-papel`

export function Perfil({
  leer = leerPerfil,
  guardar = guardarPerfil,
  normalizar = normalizarFoto,
}: Props) {
  const [perfil, setPerfil] = useState<DatosPerfil | null>(null)
  const [ciudad, setCiudad] = useState('')
  const [ocupadas, setOcupadas] = useState<Record<CampoFoto, boolean>>({
    fotoCuerpo: false,
    fotoCara: false,
  })
  const [guardandoCiudad, setGuardandoCiudad] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  useEffect(() => {
    let vigente = true
    leer().then(
      (leido) => {
        if (!vigente) return
        setPerfil(leido)
        setCiudad(leido.ciudad)
      },
      (error: unknown) => {
        console.error(error)
        if (vigente) {
          setAviso({ seccion: 'fotos', tipo: 'error', texto: 'No se ha podido leer tu perfil.' })
        }
      },
    )
    return () => {
      vigente = false
    }
  }, [leer])

  // Cada guardado solo toca su campo en pantalla, para no pisar otro cambio que siga en marcha.
  function aplicar<C extends keyof DatosPerfil>(campo: C, valor: DatosPerfil[C]) {
    setPerfil((actual) => actual && { ...actual, [campo]: valor })
  }

  function ocupar(campo: CampoFoto, ocupada: boolean) {
    setOcupadas((actuales) => ({ ...actuales, [campo]: ocupada }))
  }

  async function cambiarFoto(campo: CampoFoto, fichero: File) {
    ocupar(campo, true)
    setAviso(null)
    try {
      let foto: Blob
      try {
        foto = await normalizar(fichero)
      } catch (error) {
        if (!(error instanceof ErrorFoto)) console.error(error)
        setAviso({
          seccion: 'fotos',
          tipo: 'error',
          texto: error instanceof ErrorFoto ? error.message : 'No se pudo abrir la foto.',
        })
        return
      }
      try {
        aplicar(campo, (await guardar({ [campo]: foto }))[campo])
      } catch (error) {
        console.error(error)
        setAviso({
          seccion: 'fotos',
          tipo: 'error',
          texto: `No se ha podido guardar la foto ${NOMBRE_FOTO[campo]}.`,
        })
        return
      }
      setAviso({ seccion: 'fotos', tipo: 'bien', texto: `Foto ${NOMBRE_FOTO[campo]} guardada.` })
    } finally {
      ocupar(campo, false)
    }
  }

  async function borrarFoto(campo: CampoFoto) {
    ocupar(campo, true)
    setAviso(null)
    try {
      aplicar(campo, (await guardar({ [campo]: null }))[campo])
      setAviso({ seccion: 'fotos', tipo: 'bien', texto: `Foto ${NOMBRE_FOTO[campo]} borrada.` })
    } catch (error) {
      console.error(error)
      setAviso({
        seccion: 'fotos',
        tipo: 'error',
        texto: `No se ha podido borrar la foto ${NOMBRE_FOTO[campo]}.`,
      })
    } finally {
      ocupar(campo, false)
    }
  }

  async function guardarCiudad(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!perfil) return
    setGuardandoCiudad(true)
    setAviso(null)
    try {
      const guardada = (await guardar({ ciudad })).ciudad
      aplicar('ciudad', guardada)
      setCiudad(guardada)
      setAviso({
        seccion: 'ciudad',
        tipo: 'bien',
        texto: guardada ? 'Ciudad guardada.' : 'Ciudad quitada.',
      })
    } catch (error) {
      console.error(error)
      setAviso({ seccion: 'ciudad', tipo: 'error', texto: 'No se ha podido guardar la ciudad.' })
    } finally {
      setGuardandoCiudad(false)
    }
  }

  async function cambiarEstilo(estilo: Estilo) {
    if (!perfil) return
    const marcados = new Set(perfil.estilosFavoritos)
    if (marcados.has(estilo)) marcados.delete(estilo)
    else marcados.add(estilo)
    const estilos = ESTILOS.filter((uno) => marcados.has(uno))
    aplicar('estilosFavoritos', estilos)
    setAviso(null)
    try {
      await guardar({ estilosFavoritos: estilos })
    } catch (error) {
      console.error(error)
      setAviso({
        seccion: 'estilos',
        tipo: 'error',
        texto: 'No se han podido guardar los estilos.',
      })
      // Lo guardado manda: se vuelve a leer para no enseñar una marca que no está en el móvil.
      leer().then(
        (leido) => {
          aplicar('estilosFavoritos', leido.estilosFavoritos)
        },
        (otro: unknown) => {
          console.error(otro)
        },
      )
    }
  }

  function avisoDe(seccion: Seccion) {
    if (aviso?.seccion !== seccion) return null
    return aviso.tipo === 'bien' ? (
      <p role="status" className="text-sm">
        {aviso.texto}
      </p>
    ) : (
      <p role="alert" className="text-sm font-medium text-red-800">
        {aviso.texto}
      </p>
    )
  }

  const ciudadSinCambios = ciudad.trim() === (perfil?.ciudad ?? '')

  return (
    <Pantalla titulo="Perfil">
      <section aria-labelledby="titulo-fotos" className="flex flex-col gap-3">
        <h2 id="titulo-fotos" className="text-lg font-semibold">
          Tus fotos
        </h2>
        <p className="text-sm text-suave">
          Son opcionales. Sirven para probarte los outfits con Gemini.
        </p>
        {perfil && (
          <ul className="grid grid-cols-2 gap-3">
            <FotoPerfil
              id="titulo-foto-cuerpo"
              titulo="Cuerpo entero"
              foto={perfil.fotoCuerpo}
              camara="environment"
              ocupada={ocupadas.fotoCuerpo}
              onElegir={(fichero) => void cambiarFoto('fotoCuerpo', fichero)}
              onBorrar={() => void borrarFoto('fotoCuerpo')}
            />
            <FotoPerfil
              id="titulo-foto-cara"
              titulo="Cara"
              foto={perfil.fotoCara}
              camara="user"
              ocupada={ocupadas.fotoCara}
              onElegir={(fichero) => void cambiarFoto('fotoCara', fichero)}
              onBorrar={() => void borrarFoto('fotoCara')}
            />
          </ul>
        )}
        {avisoDe('fotos')}

        <div className="flex flex-col gap-1 rounded-2xl border border-tinta/15 bg-white/60 p-4 text-sm">
          <p className="font-medium">Para que el probador salga bien</p>
          <ul className="list-disc pl-5 text-suave">
            <li>De pie y de frente, con los brazos sueltos.</li>
            <li>Que se te vea entero, de la cabeza a los pies.</li>
            <li>Buena luz, mejor natural.</li>
            <li>Fondo liso, sin gente ni muebles detrás.</li>
            <li>Ropa ajustada y lisa.</li>
            <li>Para la cara: de frente, sin gafas de sol ni gorra.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl border border-tinta/15 p-4 text-sm">
          <p className="font-medium">Tus fotos no salen del móvil</p>
          <p className="text-suave">
            Se guardan solo en este móvil. Solo salen cuando tú las compartes con Gemini al probarte
            un outfit, o si exportas la copia del armario en Ajustes.
          </p>
        </div>
      </section>

      <section aria-labelledby="titulo-ciudad" className="flex flex-col gap-3">
        <h2 id="titulo-ciudad" className="text-lg font-semibold">
          Ciudad por defecto
        </h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(evento) => {
            void guardarCiudad(evento)
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Tu ciudad</span>
            <input
              type="text"
              value={ciudad}
              maxLength={80}
              autoComplete="address-level2"
              placeholder="Por ejemplo, Valencia"
              disabled={!perfil}
              onChange={(evento) => {
                setCiudad(evento.target.value)
              }}
              className="min-h-12 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-tinta"
            />
          </label>
          <button
            type="submit"
            className={botonPrincipal}
            disabled={!perfil || guardandoCiudad || ciudadSinCambios}
          >
            {guardandoCiudad ? 'Guardando…' : 'Guardar ciudad'}
          </button>
        </form>
        {avisoDe('ciudad')}
      </section>

      <section aria-labelledby="titulo-estilos" className="flex flex-col gap-3">
        <h2 id="titulo-estilos" className="text-lg font-semibold">
          Estilos favoritos
        </h2>
        <p className="text-sm text-suave">Marca los que más te gustan. Se guardan al tocarlos.</p>
        <ul className="flex flex-wrap gap-2">
          {ESTILOS.map((estilo) => {
            const marcado = perfil?.estilosFavoritos.includes(estilo) ?? false
            return (
              <li key={estilo}>
                <button
                  type="button"
                  aria-pressed={marcado}
                  disabled={!perfil}
                  onClick={() => void cambiarEstilo(estilo)}
                  className={`min-h-10 rounded-full border px-3 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
                    marcado ? 'border-tinta bg-tinta text-papel' : 'border-tinta/25 text-tinta'
                  }`}
                >
                  {estilo}
                </button>
              </li>
            )
          })}
        </ul>
        {avisoDe('estilos')}
      </section>
    </Pantalla>
  )
}
