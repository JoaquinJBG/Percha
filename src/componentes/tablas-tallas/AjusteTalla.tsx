import { Link } from 'react-router'
import {
  ajusteDeTalla,
  medidasQueFaltan,
  tallaRecomendada,
  textoAjuste,
  textoFaltan,
  textoRecomendacion,
  type PrendaAjuste,
} from '../../datos/ajuste.ts'
import type { Cuerpo, TablaTallas } from '../../datos/modelo.ts'

interface Props {
  tabla: TablaTallas
  cuerpo: Cuerpo | undefined
  /** La prenda del detalle: con su talla se dice cómo te queda; sin ella, qué talla pedir. */
  prenda?: PrendaAjuste & { talla?: string | undefined }
  /** En Perfil no hace falta el enlace a Perfil. */
  enPerfil?: boolean
}

/** Cómo te queda la talla según la tabla y tus medidas (T10.2). Todo se calcula en el móvil (D23). */
export function AjusteTalla({ tabla, cuerpo, prenda = {}, enPerfil = false }: Props) {
  const recomendacion = tallaRecomendada(tabla, cuerpo, prenda)
  const ajuste = prenda.talla ? ajusteDeTalla(tabla, prenda.talla, cuerpo, prenda) : null
  const frase = ajuste ? textoAjuste(ajuste, recomendacion) : null
  const faltan = medidasQueFaltan(tabla, cuerpo)

  const lineas: string[] = []
  if (frase) lineas.push(frase)
  else if (prenda.talla && !ajuste) lineas.push(`La talla ${prenda.talla} no está en la tabla.`)
  if (!frase && recomendacion) lineas.push(textoRecomendacion(recomendacion))
  if (lineas.length === 0 && faltan.length === 0) return null

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-oliva/10 p-3 text-sm">
      {lineas.map((linea) => (
        <p key={linea}>{linea}</p>
      ))}
      {faltan.length > 0 && (
        <p className="text-suave">
          {enPerfil
            ? textoFaltan(faltan).replace('en Perfil', 'en «Tu cuerpo»')
            : textoFaltan(faltan)}{' '}
          {!enPerfil && (
            <Link to="/perfil" className="font-medium text-oliva underline underline-offset-2">
              Ir a Perfil
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
