import { useEffect, useId, useRef, useState, type ReactNode, type SubmitEvent } from 'react'
import { llevaCapas } from '../../datos/capas.ts'
import {
  CAPAS,
  CATEGORIAS,
  COLORES,
  ESTAMPADOS,
  ESTILOS,
  OCASIONES,
  TEMPORADAS,
  type EtiquetasPrenda,
} from '../../datos/modelo.ts'
import { useLecturaEtiqueta, type ObtenerProveedor } from '../etiquetado-ia/index.ts'
import {
  alternar,
  borradorInicial,
  capasVisibles,
  conCambio,
  conDatosEtiqueta,
  conExtras,
  DESCRIPCION_ABRIGO,
  DESCRIPCION_FORMALIDAD,
  validarBorrador,
  type Borrador,
  type CamposEtiqueta,
  type ErroresBorrador,
} from './borrador.ts'
import { SeccionEtiqueta } from './SeccionEtiqueta.tsx'

interface Props {
  /** Valores con los que empieza (de la IA, de una prenda o nada). Para cambiarlos, cambia la `key`. */
  iniciales?: Partial<EtiquetasPrenda>
  alGuardar: (etiquetas: EtiquetasPrenda) => void
  alCancelar?: () => void
  textoGuardar?: string
  ocupado?: boolean
  /** Con él aparece «Foto de la etiqueta», que la lee con la IA (T5.1). */
  obtenerProveedor?: ObtenerProveedor
  /**
   * «Etiqueta y tienda» tal como estaba, para no perderla si el formulario se vuelve a montar (otra
   * respuesta de la IA). Pisa a `iniciales` en esos campos. Se lleva con `alCambiarEtiqueta`.
   */
  etiquetaEnCurso?: CamposEtiqueta | undefined
  alCambiarEtiqueta?: (campos: CamposEtiqueta) => void
}

const ETIQUETA_CATEGORIA: Record<(typeof CATEGORIAS)[number], string> = {
  superior: 'Parte de arriba',
  inferior: 'Parte de abajo',
  vestido: 'Vestido o mono',
  abrigo: 'Abrigo o chaqueta',
  calzado: 'Calzado',
  accesorio: 'Accesorio',
}

const MUESTRA_COLOR: Record<string, string> = {
  blanco: '#ffffff',
  crudo: '#efe6d2',
  negro: '#1d1d1d',
  gris: '#8d8d8d',
  beige: '#d9c7a7',
  camel: '#b98a4e',
  marrón: '#6b4428',
  'azul marino': '#1f2a4d',
  azul: '#2f62c4',
  celeste: '#9cc8eb',
  vaquero: '#4a6a8f',
  verde: '#3d7a46',
  caqui: '#7d7a4a',
  rojo: '#c62f2f',
  granate: '#7a1f2b',
  rosa: '#eaa3b6',
  morado: '#6d3f8f',
  amarillo: '#ecc94b',
  naranja: '#e57d2c',
  dorado: '#c9a227',
  plateado: '#c3c7cc',
}

const chip =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-tinta/25 px-3 text-sm has-checked:border-tinta has-checked:bg-oliva has-checked:text-papel has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-oliva'
const campo =
  'min-h-12 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva'
const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'

function Grupo({
  titulo,
  error,
  ayuda,
  children,
}: {
  titulo: string
  error?: string | undefined
  ayuda?: string
  children: ReactNode
}) {
  const idError = useId()
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? idError : undefined}>
      <legend className="mb-2 font-medium">{titulo}</legend>
      {ayuda && <p className="-mt-2 text-sm text-suave">{ayuda}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && (
        <p id={idError} role="alert" className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function Casillas<T extends string>({
  titulo,
  opciones,
  elegidas,
  cambiar,
  muestra,
  error,
  ayuda,
}: {
  titulo: string
  opciones: readonly T[]
  elegidas: T[]
  cambiar: (valores: T[]) => void
  muestra?: (valor: T) => string | undefined
  error?: string | undefined
  ayuda?: string
}) {
  return (
    <Grupo titulo={titulo} error={error} {...(ayuda && { ayuda })}>
      {opciones.map((opcion) => {
        const color = muestra?.(opcion)
        return (
          <label key={opcion} className={chip}>
            <input
              type="checkbox"
              className="sr-only"
              checked={elegidas.includes(opcion)}
              onChange={() => {
                cambiar(alternar(elegidas, opcion))
              }}
            />
            {color && (
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-tinta/30"
                style={{ backgroundColor: color }}
              />
            )}
            {opcion}
          </label>
        )
      })}
    </Grupo>
  )
}

function Nivel({
  titulo,
  nombre,
  valor,
  descripciones,
  cambiar,
}: {
  titulo: string
  nombre: string
  valor: number
  descripciones: string[]
  cambiar: (valor: number) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">
        {titulo}: {valor} · {descripciones[valor - 1]}
      </legend>
      <div className="grid grid-cols-5 gap-2">
        {descripciones.map((descripcion, i) => (
          <label key={descripcion} className={`${chip} justify-center`}>
            <input
              type="radio"
              name={nombre}
              className="sr-only"
              aria-label={`${String(i + 1)}: ${descripcion}`}
              checked={valor === i + 1}
              onChange={() => {
                cambiar(i + 1)
              }}
            />
            {i + 1}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Edita las etiquetas de una prenda y devuelve los campos ya validados con Zod. */
export function FormularioPrenda({
  iniciales,
  alGuardar,
  alCancelar,
  textoGuardar = 'Guardar',
  ocupado = false,
  obtenerProveedor,
  etiquetaEnCurso,
  alCambiarEtiqueta,
}: Props) {
  const [borrador, setBorrador] = useState(() => borradorInicial(iniciales, etiquetaEnCurso))
  const lectura = useLecturaEtiqueta(obtenerProveedor ?? (() => Promise.resolve(null)))
  const bloqueado = ocupado || lectura.leyendo
  const { marca, referencia, talla, composicion, enlace } = borrador

  useEffect(() => {
    alCambiarEtiqueta?.({ marca, referencia, talla, composicion, enlace })
  }, [alCambiarEtiqueta, marca, referencia, talla, composicion, enlace])
  // Los colores fuera de la lista siguen a la vista aunque se desmarquen, para poder volver a marcarlos.
  const [coloresIniciales] = useState(() => borrador.colores)
  const [errores, setErrores] = useState<ErroresBorrador>({})
  const formulario = useRef<HTMLFormElement>(null)
  const nombre = useId()

  function cambiar<K extends keyof Borrador>(campo: K, valor: Borrador[K]) {
    setBorrador((anterior) => conCambio(anterior, campo, valor))
    setErrores((anteriores) => ({ ...anteriores, [campo]: undefined }))
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    const resultado = validarBorrador(borrador)
    if (resultado.valido) {
      alGuardar(resultado.etiquetas)
      return
    }
    setErrores(resultado.errores)
    // Lo único que se puede dejar sin elegir es la categoría.
    if (resultado.errores.categoria) {
      formulario.current
        ?.querySelector<HTMLInputElement>(`input[name="${nombre}-categoria"]`)
        ?.focus()
    }
  }

  return (
    <form ref={formulario} noValidate className="flex flex-col gap-6" onSubmit={enviar}>
      <Grupo titulo="Categoría" error={errores.categoria}>
        {CATEGORIAS.map((categoria) => (
          <label key={categoria} className={chip}>
            <input
              type="radio"
              name={`${nombre}-categoria`}
              className="sr-only"
              checked={borrador.categoria === categoria}
              onChange={() => {
                cambiar('categoria', categoria)
              }}
            />
            {ETIQUETA_CATEGORIA[categoria]}
          </label>
        ))}
      </Grupo>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Tipo de prenda</span>
        <input
          className={campo}
          value={borrador.subcategoria}
          placeholder="camiseta, vaqueros, zapatillas…"
          onChange={(evento) => {
            cambiar('subcategoria', evento.target.value)
          }}
        />
      </label>

      {borrador.categoria && llevaCapas(borrador.categoria) && (
        <Casillas
          titulo="Puede ir como"
          ayuda="Base: sobre la piel. Media: entre capas. Exterior: lo de fuera."
          opciones={CAPAS}
          elegidas={capasVisibles(borrador)}
          error={errores.capas}
          cambiar={(capas) => {
            cambiar('capas', capas)
          }}
        />
      )}

      <Casillas
        titulo="Colores"
        opciones={conExtras(COLORES, [...coloresIniciales, ...borrador.colores])}
        elegidas={borrador.colores}
        cambiar={(colores) => {
          cambiar('colores', colores)
        }}
        muestra={(color) => MUESTRA_COLOR[color]}
      />

      <label className="flex flex-col gap-1">
        <span className="font-medium">Estampado</span>
        <select
          className={campo}
          value={borrador.estampado}
          onChange={(evento) => {
            cambiar('estampado', evento.target.value)
          }}
        >
          <option value="">Sin indicar</option>
          {conExtras(ESTAMPADOS, [borrador.estampado]).map((estampado) => (
            <option key={estampado} value={estampado}>
              {estampado}
            </option>
          ))}
        </select>
      </label>

      <Casillas
        titulo="Estilos"
        opciones={ESTILOS}
        elegidas={borrador.estilos}
        cambiar={(estilos) => {
          cambiar('estilos', estilos)
        }}
      />
      <Casillas
        titulo="Ocasiones"
        opciones={OCASIONES}
        elegidas={borrador.ocasiones}
        cambiar={(ocasiones) => {
          cambiar('ocasiones', ocasiones)
        }}
      />

      <Nivel
        titulo="Abrigo"
        nombre={`${nombre}-abrigo`}
        valor={borrador.abrigo}
        descripciones={DESCRIPCION_ABRIGO}
        cambiar={(abrigo) => {
          cambiar('abrigo', abrigo)
        }}
      />
      <Nivel
        titulo="Formalidad"
        nombre={`${nombre}-formalidad`}
        valor={borrador.formalidad}
        descripciones={DESCRIPCION_FORMALIDAD}
        cambiar={(formalidad) => {
          cambiar('formalidad', formalidad)
        }}
      />

      <Casillas
        titulo="Temporadas"
        opciones={TEMPORADAS}
        elegidas={borrador.temporadas}
        cambiar={(temporadas) => {
          cambiar('temporadas', temporadas)
        }}
      />

      <SeccionEtiqueta
        valores={borrador}
        errores={errores}
        cambiar={cambiar}
        lectura={obtenerProveedor ? lectura : null}
        ocupado={ocupado}
        alLeer={(datos) => {
          setBorrador((anterior) => conDatosEtiqueta(anterior, datos))
          setErrores((anteriores) => ({ ...anteriores, composicion: undefined }))
        }}
      />

      <label className="flex flex-col gap-1">
        <span className="font-medium">Notas</span>
        <textarea
          className={`${campo} min-h-24 py-2`}
          value={borrador.notas}
          placeholder="Material, corte, con qué combina…"
          onChange={(evento) => {
            cambiar('notas', evento.target.value)
          }}
        />
      </label>

      <div className="flex flex-col gap-3">
        <button type="submit" className={`${boton} bg-oliva text-papel`} disabled={bloqueado}>
          {textoGuardar}
        </button>
        {alCancelar && (
          <button
            type="button"
            className={`${boton} border border-tinta/25 text-tinta`}
            disabled={bloqueado}
            onClick={alCancelar}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
