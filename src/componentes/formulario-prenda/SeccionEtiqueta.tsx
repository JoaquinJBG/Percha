import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { esEnlaceWeb, MAX_COMPONENTES, type DatosEtiqueta } from '../../datos/modelo.ts'
import { EnlacesBusqueda } from '../../etiqueta/EnlacesBusqueda.tsx'
import { AvisoEtiquetado, type AvisoIA, type useLecturaEtiqueta } from '../etiquetado-ia/index.ts'
import {
  LARGO_MAXIMO,
  type Borrador,
  type CamposEtiqueta,
  type ErroresBorrador,
  type FilaComposicion,
} from './borrador.ts'

interface Props {
  valores: CamposEtiqueta
  errores: ErroresBorrador
  cambiar: <K extends keyof Borrador>(campo: K, valor: Borrador[K]) => void
  /** Con ella aparece «Foto de la etiqueta». Vive en el formulario, que no deja guardar mientras lee. */
  lectura: ReturnType<typeof useLecturaEtiqueta> | null
  alLeer: (datos: DatosEtiqueta) => void
  ocupado: boolean
}

const campo =
  'min-h-12 w-full min-w-0 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva'
const botonSecundario =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-tinta/25 px-4 font-medium text-tinta disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'

const NOMBRES: Record<keyof DatosEtiqueta, string> = {
  marca: 'marca',
  referencia: 'referencia',
  talla: 'talla',
  composicion: 'composición',
}

function resumenLectura(datos: DatosEtiqueta): string {
  const leidos = (Object.keys(NOMBRES) as (keyof DatosEtiqueta)[])
    .filter((clave) => datos[clave] !== undefined)
    .map((clave) => NOMBRES[clave])
  if (leidos.length === 0) {
    return 'No se ha leído nada en la etiqueta. Prueba con otra foto, más cerca y con luz.'
  }
  const lista =
    leidos.length === 1 ? leidos[0] : `${leidos.slice(0, -1).join(', ')} y ${leidos.at(-1) ?? ''}`
  return `Leído de la etiqueta: ${lista ?? ''}. Revísalo antes de guardar.`
}

function Campo({
  etiqueta,
  error,
  idError,
  children,
}: {
  etiqueta: string
  error: string | undefined
  idError: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{etiqueta}</span>
        {children}
      </label>
      <MensajeError id={idError} texto={error} />
    </div>
  )
}

function MensajeError({ id, texto }: { id: string; texto: string | undefined }) {
  return texto ? (
    <p id={id} role="alert" className="text-sm font-medium text-red-800">
      {texto}
    </p>
  ) : null
}

/** Marca, referencia, talla, composición y enlace de la ficha (T5.1). Todo opcional. */
export function SeccionEtiqueta({ valores, errores, cambiar, lectura, alLeer, ocupado }: Props) {
  const id = useId()
  const [resultado, setResultado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<AvisoIA | null>(null)
  // La foto solo vive aquí, para «Probar otra vez»: no se guarda en la prenda.
  const ultimaFoto = useRef<Blob | null>(null)

  async function leer(foto: Blob) {
    ultimaFoto.current = foto
    setResultado(null)
    setAviso(null)
    if (!lectura) return
    const leido = await lectura.leer(foto)
    if (!leido) return
    if ('aviso' in leido) {
      setAviso(leido.aviso)
      return
    }
    alLeer(leido.datos)
    setResultado(resumenLectura(leido.datos))
  }

  function elegirFoto(evento: ChangeEvent<HTMLInputElement>) {
    const foto = evento.target.files?.[0]
    // Para poder volver a elegir la misma foto.
    evento.target.value = ''
    if (foto) void leer(foto)
  }

  function cambiarFila(indice: number, cambio: Partial<FilaComposicion>) {
    cambiar(
      'composicion',
      valores.composicion.map((fila, i) => (i === indice ? { ...fila, ...cambio } : fila)),
    )
  }

  const enlaceValido = valores.enlace.trim() !== '' && esEnlaceWeb(valores.enlace.trim())

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-4 rounded-2xl border border-tinta/15 bg-white/60 p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-titulo`} className="font-semibold">
          Etiqueta y tienda
        </h3>
        <p className="text-sm text-suave">
          Opcional. Con la marca y la referencia salen enlaces para buscar la prenda.
        </p>
      </div>

      {lectura && (
        <div className="flex flex-col gap-2">
          {lectura.leyendo ? (
            <div className="flex items-center justify-between gap-3">
              <p role="status">Leyendo la etiqueta…</p>
              <button type="button" className={botonSecundario} onClick={lectura.cancelar}>
                Dejarlo
              </button>
            </div>
          ) : (
            <label
              className={`${botonSecundario} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-oliva ${ocupado ? 'pointer-events-none opacity-50' : ''}`}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={ocupado}
                onChange={elegirFoto}
              />
              Foto de la etiqueta
            </label>
          )}
          <p className="text-xs text-suave">
            La lee la IA para rellenar estos campos. La foto no se guarda.
          </p>
          {resultado && (
            <p role="status" className="text-sm">
              {resultado}
            </p>
          )}
          {aviso && (
            <AvisoEtiquetado
              aviso={aviso}
              onReintentar={() => {
                if (ultimaFoto.current) void leer(ultimaFoto.current)
              }}
              nota={
                aviso.ajustes
                  ? 'Puedes escribirlos a mano. Si vas ahora a Ajustes, lo que no hayas guardado se pierde.'
                  : 'Puedes escribirlos a mano o probar otra vez.'
              }
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Marca" error={errores.marca} idError={`${id}-error-marca`}>
          <input
            className={campo}
            value={valores.marca}
            maxLength={LARGO_MAXIMO.marca}
            aria-describedby={errores.marca ? `${id}-error-marca` : undefined}
            autoComplete="off"
            placeholder="Zara, H&M…"
            onChange={(evento) => {
              cambiar('marca', evento.target.value)
            }}
          />
        </Campo>
        <Campo etiqueta="Talla" error={errores.talla} idError={`${id}-error-talla`}>
          <input
            className={campo}
            value={valores.talla}
            maxLength={LARGO_MAXIMO.talla}
            aria-describedby={errores.talla ? `${id}-error-talla` : undefined}
            autoComplete="off"
            placeholder="M, 42…"
            onChange={(evento) => {
              cambiar('talla', evento.target.value)
            }}
          />
        </Campo>
      </div>
      <Campo etiqueta="Referencia" error={errores.referencia} idError={`${id}-error-referencia`}>
        <input
          className={campo}
          value={valores.referencia}
          maxLength={LARGO_MAXIMO.referencia}
          aria-describedby={errores.referencia ? `${id}-error-referencia` : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="4085/021, DD1391-100…"
          onChange={(evento) => {
            cambiar('referencia', evento.target.value)
          }}
        />
      </Campo>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={errores.composicion ? `${id}-error-composicion` : undefined}
      >
        <legend className="mb-2 font-medium">Composición</legend>
        {valores.composicion.map((fila, i) => (
          <div key={i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
            <input
              className={campo}
              aria-label={`Material ${String(i + 1)}`}
              value={fila.material}
              placeholder="algodón"
              onChange={(evento) => {
                cambiarFila(i, { material: evento.target.value })
              }}
            />
            <div className="relative">
              <input
                className={`${campo} pr-7`}
                aria-label={`Porcentaje del material ${String(i + 1)}`}
                inputMode="decimal"
                value={fila.porcentaje}
                onChange={(evento) => {
                  cambiarFila(i, { porcentaje: evento.target.value })
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-suave"
              >
                %
              </span>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-lg px-2 text-sm text-suave underline"
              aria-label={`Quitar el material ${String(i + 1)}`}
              onClick={() => {
                cambiar(
                  'composicion',
                  valores.composicion.filter((_, j) => j !== i),
                )
              }}
            >
              Quitar
            </button>
          </div>
        ))}
        {valores.composicion.length < MAX_COMPONENTES && (
          <button
            type="button"
            className={`${botonSecundario} self-start`}
            onClick={() => {
              cambiar('composicion', [...valores.composicion, { material: '', porcentaje: '' }])
            }}
          >
            Añadir material
          </button>
        )}
        <MensajeError id={`${id}-error-composicion`} texto={errores.composicion} />
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Enlace a la ficha de la tienda</span>
        <input
          className={campo}
          type="url"
          inputMode="url"
          autoComplete="off"
          value={valores.enlace}
          placeholder="https://…"
          aria-describedby={errores.enlace ? `${id}-error-enlace` : undefined}
          onChange={(evento) => {
            cambiar('enlace', evento.target.value)
          }}
        />
      </label>
      <MensajeError id={`${id}-error-enlace`} texto={errores.enlace} />

      <EnlacesBusqueda
        marca={valores.marca}
        referencia={valores.referencia}
        enlace={enlaceValido ? valores.enlace.trim() : undefined}
      />
    </section>
  )
}
