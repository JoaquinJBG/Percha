import { useId, useState, type SubmitEvent } from 'react'
import {
  MEDIDAS_POR_TIPO,
  TIPOS_TALLA,
  type DatosTablaTallas,
  type MedidaTalla,
} from '../../datos/modelo.ts'
import {
  borradorDe,
  filaVacia,
  NOMBRE_MEDIDA,
  validarBorradorTabla,
  type BorradorTabla,
} from './tablas.ts'

interface Props {
  inicial: Partial<DatosTablaTallas>
  alGuardar: (datos: DatosTablaTallas) => void
  alCancelar: () => void
  ocupado: boolean
}

const campo =
  'min-h-12 w-full min-w-0 rounded-xl border border-tinta/25 bg-white px-3 focus-visible:outline-2 focus-visible:outline-oliva'
const celda =
  'min-h-11 w-16 rounded-lg border border-tinta/25 bg-white px-2 text-center focus-visible:outline-2 focus-visible:outline-oliva'
const boton =
  'min-h-12 rounded-xl px-4 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oliva'

/** Revisar lo leído de la foto o escribir la tabla a mano. Los números, en cm. */
export function EditorTablaTallas({ inicial, alGuardar, alCancelar, ocupado }: Props) {
  const id = useId()
  const [borrador, setBorrador] = useState<BorradorTabla>(() => borradorDe(inicial))
  const [error, setError] = useState<string | null>(null)
  const medidas = MEDIDAS_POR_TIPO[borrador.tipo]

  function cambiar(cambios: Partial<BorradorTabla>) {
    setBorrador((anterior) => ({ ...anterior, ...cambios }))
    setError(null)
  }

  function cambiarCelda(fila: number, columna: 'talla' | MedidaTalla, valor: string) {
    cambiar({
      filas: borrador.filas.map((f, i) => (i === fila ? { ...f, [columna]: valor } : f)),
    })
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    const resultado = validarBorradorTabla(borrador)
    if (resultado.valida) alGuardar(resultado.datos)
    else setError(resultado.error)
  }

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={enviar}>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Marca</span>
          <input
            className={campo}
            value={borrador.marca}
            maxLength={40}
            onChange={(e) => {
              cambiar({ marca: e.target.value })
            }}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Tipo</span>
          <select
            className={campo}
            value={borrador.tipo}
            onChange={(e) => {
              cambiar({ tipo: TIPOS_TALLA.find((t) => t === e.target.value) ?? borrador.tipo })
            }}
          >
            {TIPOS_TALLA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Las medidas son</span>
        <select
          className={campo}
          value={borrador.medidaDe}
          onChange={(e) => {
            cambiar({ medidaDe: e.target.value === 'prenda' ? 'prenda' : 'cuerpo' })
          }}
        >
          <option value="cuerpo">de tu cuerpo</option>
          <option value="prenda">de la prenda</option>
        </select>
      </label>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="border-separate border-spacing-1 text-sm">
          <caption className="sr-only">Tallas y medidas en cm</caption>
          <thead>
            <tr>
              <th scope="col" className="text-left font-medium">
                Talla
              </th>
              {medidas.map((m) => (
                <th key={m} scope="col" className="text-left font-medium">
                  {NOMBRE_MEDIDA[m]}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {borrador.filas.map((fila, i) => {
              const nombre = fila.talla.trim() || String(i + 1)
              return (
                <tr key={i}>
                  <td>
                    <input
                      className={celda}
                      aria-label={`Talla de la fila ${String(i + 1)}`}
                      value={fila.talla}
                      maxLength={20}
                      onChange={(e) => {
                        cambiarCelda(i, 'talla', e.target.value)
                      }}
                    />
                  </td>
                  {medidas.map((m) => (
                    <td key={m}>
                      <input
                        className={celda}
                        inputMode="decimal"
                        aria-label={`${NOMBRE_MEDIDA[m]} de la talla ${nombre} (cm)`}
                        value={fila[m]}
                        onChange={(e) => {
                          cambiarCelda(i, m, e.target.value)
                        }}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-lg text-suave"
                      aria-label={`Quitar la talla ${nombre}`}
                      onClick={() => {
                        const filas = borrador.filas.filter((_, j) => j !== i)
                        cambiar({ filas: filas.length > 0 ? filas : [filaVacia()] })
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-suave">En cm. Con un rango («88-92»), el punto medio.</p>
      <button
        type="button"
        className={`${boton} border border-tinta/25 text-tinta`}
        onClick={() => {
          cambiar({ filas: [...borrador.filas, filaVacia()] })
        }}
      >
        Añadir talla
      </button>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button type="submit" className={`${boton} bg-oliva text-papel`} disabled={ocupado}>
          Guardar tabla
        </button>
        <button
          type="button"
          className={`${boton} border border-tinta/25 text-tinta`}
          disabled={ocupado}
          onClick={alCancelar}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
