import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Pantalla } from '../../componentes/Pantalla.tsx'
import { ESTILOS, type Estilo, type Perfil as DatosPerfil } from '../../datos/modelo.ts'
import {
  guardarFotoInterior,
  guardarPerfil,
  leerFotoInterior,
  leerPerfil,
} from '../../datos/repositorio.ts'
import { ErrorFoto, normalizarFoto } from '../../recorte/index.ts'
import { CuerpoPerfil } from './CuerpoPerfil.tsx'
import { FotoPerfil } from './FotoPerfil.tsx'
import { GuiaFotoReferencia } from './GuiaFotoReferencia.tsx'
import { TablasTallas } from '../../componentes/tablas-tallas/index.ts'
import { TallasPerfil } from './TallasPerfil.tsx'
import { TrabajoPerfil } from './TrabajoPerfil.tsx'

interface Props {
  leer?: () => Promise<DatosPerfil>
  guardar?: (cambios: Partial<DatosPerfil>) => Promise<DatosPerfil>
  normalizar?: (foto: Blob) => Promise<Blob>
  /** La foto en ropa interior va aparte del perfil (D21). */
  leerInterior?: () => Promise<Blob | null>
  guardarInterior?: (foto: Blob | null) => Promise<Blob | null>
}

type CampoFoto = 'fotoCuerpo' | 'fotoCara' | 'fotoInterior'
// Cada parte lleva su aviso, para que un error no quede tapado por el «guardado» de otra.
type Seccion = 'lectura' | CampoFoto | 'ciudad' | 'estilos'
interface Aviso {
  tipo: 'bien' | 'error'
  texto: string
}

const NOMBRE_FOTO: Record<CampoFoto, string> = {
  fotoCuerpo: 'de cuerpo entero',
  fotoCara: 'de cara',
  fotoInterior: 'en ropa interior',
}

const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'
const botonPrincipal = `${boton} bg-oliva text-papel`

export function Perfil({
  leer = leerPerfil,
  guardar = guardarPerfil,
  normalizar = normalizarFoto,
  leerInterior = leerFotoInterior,
  guardarInterior = guardarFotoInterior,
}: Props) {
  const [perfil, setPerfil] = useState<DatosPerfil | null>(null)
  // `undefined` mientras se lee.
  const [fotoInterior, setFotoInterior] = useState<Blob | null | undefined>(undefined)
  const [ciudad, setCiudad] = useState('')
  const [ocupadas, setOcupadas] = useState<Record<CampoFoto, boolean>>({
    fotoCuerpo: false,
    fotoCara: false,
    fotoInterior: false,
  })
  const [guardandoCiudad, setGuardandoCiudad] = useState(false)
  const [avisos, setAvisos] = useState<Partial<Record<Seccion, Aviso>>>({})
  // Cuántos toques de estilos van: si falla uno pero llega otro detrás, el último guarda la lista entera.
  const toquesEstilos = useRef(0)

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
          avisar('lectura', { tipo: 'error', texto: 'No se ha podido leer tu perfil.' })
        }
      },
    )
    return () => {
      vigente = false
    }
  }, [leer])

  useEffect(() => {
    let vigente = true
    leerInterior().then(
      (leida) => {
        if (vigente) setFotoInterior(leida)
      },
      (error: unknown) => {
        console.error(error)
        if (!vigente) return
        setFotoInterior(null)
        avisar('fotoInterior', {
          tipo: 'error',
          texto: 'No se ha podido leer la foto en ropa interior.',
        })
      },
    )
    return () => {
      vigente = false
    }
  }, [leerInterior])

  // Cada guardado solo toca su campo en pantalla, para no pisar otro cambio que siga en marcha.
  function aplicar<C extends keyof DatosPerfil>(campo: C, valor: DatosPerfil[C]) {
    setPerfil((actual) => actual && { ...actual, [campo]: valor })
  }

  function avisar(seccion: Seccion, aviso: Aviso | null) {
    setAvisos((actuales) => ({ ...actuales, [seccion]: aviso ?? undefined }))
  }

  /** Para las partes que llevan su propio aviso: guarda un campo y lo pone en pantalla, o lanza. */
  async function guardarCampo<C extends keyof DatosPerfil>(campo: C, valor: DatosPerfil[C]) {
    const guardado = await guardar({ [campo]: valor })
    aplicar(campo, guardado[campo])
  }

  /** Guarda o borra (`null`) una foto y la pone en pantalla; la de ropa interior va a su tabla. */
  async function guardarFoto(campo: CampoFoto, foto: Blob | null) {
    if (campo === 'fotoInterior') {
      setFotoInterior(await guardarInterior(foto))
      return
    }
    aplicar(campo, (await guardar({ [campo]: foto }))[campo])
  }

  function ocupar(campo: CampoFoto, ocupada: boolean) {
    setOcupadas((actuales) => ({ ...actuales, [campo]: ocupada }))
  }

  async function cambiarFoto(campo: CampoFoto, fichero: File) {
    ocupar(campo, true)
    avisar(campo, null)
    try {
      let foto: Blob
      try {
        foto = await normalizar(fichero)
      } catch (error) {
        if (!(error instanceof ErrorFoto)) console.error(error)
        avisar(campo, {
          tipo: 'error',
          texto: error instanceof ErrorFoto ? error.message : 'No se pudo abrir la foto.',
        })
        return
      }
      try {
        await guardarFoto(campo, foto)
      } catch (error) {
        console.error(error)
        avisar(campo, {
          tipo: 'error',
          texto: `No se ha podido guardar la foto ${NOMBRE_FOTO[campo]}.`,
        })
        return
      }
      avisar(campo, { tipo: 'bien', texto: `Foto ${NOMBRE_FOTO[campo]} guardada.` })
    } finally {
      ocupar(campo, false)
    }
  }

  async function borrarFoto(campo: CampoFoto) {
    ocupar(campo, true)
    avisar(campo, null)
    try {
      await guardarFoto(campo, null)
      avisar(campo, { tipo: 'bien', texto: `Foto ${NOMBRE_FOTO[campo]} borrada.` })
    } catch (error) {
      console.error(error)
      avisar(campo, {
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
    avisar('ciudad', null)
    try {
      const guardada = (await guardar({ ciudad })).ciudad
      aplicar('ciudad', guardada)
      setCiudad(guardada)
      avisar('ciudad', {
        tipo: 'bien',
        texto: guardada ? 'Ciudad guardada.' : 'Ciudad quitada.',
      })
    } catch (error) {
      console.error(error)
      avisar('ciudad', { tipo: 'error', texto: 'No se ha podido guardar la ciudad.' })
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
    avisar('estilos', null)
    const toque = ++toquesEstilos.current
    try {
      await guardar({ estilosFavoritos: estilos })
    } catch (error) {
      console.error(error)
      avisar('estilos', { tipo: 'error', texto: 'No se han podido guardar los estilos.' })
      if (toque !== toquesEstilos.current) return
      // Lo guardado manda: se vuelve a leer para no enseñar una marca que no está en el móvil.
      leer().then(
        (leido) => {
          if (toque === toquesEstilos.current) aplicar('estilosFavoritos', leido.estilosFavoritos)
        },
        (otro: unknown) => {
          console.error(otro)
        },
      )
    }
  }

  function avisoDe(seccion: Seccion) {
    const aviso = avisos[seccion]
    if (!aviso) return null
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
        <h2 id="titulo-fotos" className="font-titulo text-xl font-semibold">
          Tus fotos
        </h2>
        <p className="text-sm text-suave">
          Son opcionales. Sirven para probarte los outfits con Gemini o en el probador de tu PC.
        </p>
        {avisoDe('lectura')}
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
        {avisoDe('fotoCuerpo')}
        {avisoDe('fotoCara')}
        <p className="text-sm text-suave">
          La de cuerpo entero es tu foto de referencia. La de cara: de frente, sin gafas de sol ni
          gorra.
        </p>
        <GuiaFotoReferencia />

        <div className="flex flex-col gap-1 rounded-2xl border border-tinta/15 p-4 text-sm">
          <p className="font-medium">Tus fotos no salen del móvil</p>
          <p className="text-suave">
            Se guardan solo en este móvil. Solo salen cuando tú las compartes con Gemini o con tu PC
            al probarte un outfit, o si exportas la copia del armario en Ajustes.
          </p>
        </div>
      </section>

      <section aria-labelledby="titulo-interior" className="flex flex-col gap-3">
        <h2 id="titulo-interior" className="font-titulo text-xl font-semibold">
          Foto en ropa interior
        </h2>
        <div className="flex flex-col gap-1 rounded-2xl border border-tinta/15 p-4 text-sm">
          <p className="font-medium">Opcional y solo para el probador de tu PC</p>
          <p className="text-suave">
            Con ella, tu PC ajusta mejor la ropa a tu cuerpo. Nunca se manda a Gemini ni a ninguna
            nube, no va en la copia del armario y no vuelve al importar una. Se queda solo en este
            móvil hasta que la borres. Hazla con la misma pose y encuadre que la de referencia.
          </p>
        </div>
        {fotoInterior !== undefined && (
          <ul className="grid grid-cols-2 gap-3">
            <FotoPerfil
              id="titulo-foto-interior"
              titulo="Ropa interior"
              foto={fotoInterior}
              camara="environment"
              ocupada={ocupadas.fotoInterior}
              onElegir={(fichero) => void cambiarFoto('fotoInterior', fichero)}
              onBorrar={() => void borrarFoto('fotoInterior')}
            />
          </ul>
        )}
        {avisoDe('fotoInterior')}
      </section>

      {perfil && (
        <>
          <section aria-labelledby="titulo-cuerpo" className="flex flex-col gap-3">
            <h2 id="titulo-cuerpo" className="font-titulo text-xl font-semibold">
              Tu cuerpo
            </h2>
            <p className="text-sm text-suave">
              Todo es opcional. Servirá para ajustar los outfits y las tallas a tu cuerpo. Se queda
              en este móvil y no se manda a Gemini; solo sale si exportas la copia en Ajustes.
            </p>
            <CuerpoPerfil
              cuerpo={perfil.cuerpo}
              guardar={(cuerpo) => guardarCampo('cuerpo', cuerpo)}
            />
          </section>

          <section aria-labelledby="titulo-tallas" className="flex flex-col gap-3">
            <h2 id="titulo-tallas" className="font-titulo text-xl font-semibold">
              Tus tallas por marca
            </h2>
            <p className="text-sm text-suave">La talla que sueles llevar en cada marca.</p>
            <TallasPerfil
              tallas={perfil.tallas ?? []}
              guardar={(tallas) => guardarCampo('tallas', tallas)}
            />
            <h3 className="mt-2 font-semibold">Tablas de tallas de las tiendas</h3>
            <TablasTallas cuerpo={perfil.cuerpo ?? null} />
          </section>

          <section aria-labelledby="titulo-trabajo" className="flex flex-col gap-3">
            <h2 id="titulo-trabajo" className="font-titulo text-xl font-semibold">
              Trabajo y temperatura
            </h2>
            <TrabajoPerfil
              oficina={perfil.oficina}
              sensacionTermica={perfil.sensacionTermica}
              guardarOficina={(oficina) => guardarCampo('oficina', oficina)}
              guardarSensacion={(sensacion) => guardarCampo('sensacionTermica', sensacion)}
            />
          </section>
        </>
      )}

      <section aria-labelledby="titulo-ciudad" className="flex flex-col gap-3">
        <h2 id="titulo-ciudad" className="font-titulo text-xl font-semibold">
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
              disabled={!perfil || guardandoCiudad}
              onChange={(evento) => {
                setCiudad(evento.target.value)
              }}
              className="min-h-12 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva"
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
        <h2 id="titulo-estilos" className="font-titulo text-xl font-semibold">
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
                  className={`min-h-10 rounded-full border px-3 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva ${
                    marcado ? 'border-oliva bg-oliva text-papel' : 'border-tinta/25 text-tinta'
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
