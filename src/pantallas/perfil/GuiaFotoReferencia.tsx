/** Dibujo de líneas de la pose y el encuadre: sin fotos de nadie, solo trazos en código. */
function DibujoPose() {
  return (
    <svg
      viewBox="0 0 320 250"
      role="img"
      aria-labelledby="dibujo-pose-titulo"
      className="h-auto w-full max-w-sm text-tinta"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title id="dibujo-pose-titulo">
        Persona de pie y de frente, con los pies separados al ancho de los hombros y los brazos un
        poco abiertos; el móvil en vertical a la altura del pecho, a unos 3 metros.
      </title>
      {/* Suelo */}
      <line x1="10" y1="232" x2="310" y2="232" strokeWidth={2} className="text-suave" />
      {/* Cabeza y cuello */}
      <circle cx="80" cy="38" r="16" />
      <line x1="80" y1="54" x2="80" y2="62" />
      {/* Camiseta de tirantes ajustada */}
      <path d="M66 64 L94 64 L98 132 L62 132 Z" className="fill-oliva/20" />
      <path d="M70 64 L72 56 M90 64 L88 56" strokeWidth={2} />
      {/* Brazos un poco separados del cuerpo */}
      <path d="M64 66 L50 104 L44 138" />
      <path d="M96 66 L110 104 L116 138" />
      {/* Mallas: piernas separadas al ancho de los hombros */}
      <path
        d="M62 132 L98 132 L94 150 L82 150 L80 142 L78 150 L66 150 Z"
        className="fill-oliva/20"
      />
      <path d="M66 150 L62 226 M82 150 L72 226 M78 150 L88 226 M94 150 L98 226" />
      {/* Pies */}
      <path d="M62 228 L54 230 M98 228 L106 230" />
      {/* Móvil en vertical, a la altura del pecho, sobre un apoyo */}
      <rect x="262" y="78" width="16" height="28" rx="3" className="fill-papel" />
      <line x1="270" y1="106" x2="270" y2="232" strokeWidth={2} className="text-suave" />
      <circle cx="270" cy="84" r="1.5" />
      {/* Distancia */}
      <line x1="128" y1="92" x2="252" y2="92" strokeDasharray="6 6" strokeWidth={2} />
      <path d="M244 86 L252 92 L244 98" strokeWidth={2} />
      <text
        x="190"
        y="82"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="16"
        fontWeight="600"
      >
        ≈ 3 m
      </text>
      <text x="232" y="128" fill="currentColor" stroke="none" fontSize="11">
        a la altura
      </text>
      <text x="232" y="141" fill="currentColor" stroke="none" fontSize="11">
        del pecho
      </text>
    </svg>
  )
}

/**
 * Cómo hacer la foto de referencia (T8.3): la ropa, la pose y el encuadre que mejor le van al probador
 * del PC y a Gemini. Plegada al lado del botón de la foto.
 */
export function GuiaFotoReferencia() {
  return (
    <details className="rounded-2xl bg-white p-4 text-sm shadow-tarjeta">
      <summary className="min-h-8 cursor-pointer content-center font-medium">
        Cómo hacer la foto de referencia
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <DibujoPose />
        <div>
          <p className="font-medium">Ropa</p>
          <ul className="list-disc pl-5 text-suave">
            <li>Camiseta de tirantes ajustada y leggings o mallas de correr, lisos.</li>
            <li>Si no tienes, una camiseta ajustada lisa y un pantalón largo.</li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Pose</p>
          <ul className="list-disc pl-5 text-suave">
            <li>De pie y de frente, de la cabeza a los pies.</li>
            <li>Pies separados al ancho de los hombros.</li>
            <li>Brazos un poco separados del cuerpo.</li>
            <li>Fondo liso y claro, sin gente ni muebles detrás.</li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Encuadre</p>
          <ul className="list-disc pl-5 text-suave">
            <li>Móvil en vertical, a la altura del pecho.</li>
            <li>A unos 3 metros: pide ayuda o apoya el móvil y usa el temporizador.</li>
            <li>Buena luz, mejor natural.</li>
          </ul>
        </div>
      </div>
    </details>
  )
}
