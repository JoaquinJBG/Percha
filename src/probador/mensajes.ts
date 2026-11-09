import { ErrorProbador, type MotivoProbador } from './cliente.ts'

const MENSAJES: Record<MotivoProbador, string> = {
  red: 'Tu PC no responde. Mira que esté encendido, con el probador arrancado y Tailscale conectado en el móvil.',
  clave: 'Tu PC no acepta la clave. Cópiala otra vez de la consola del probador en Ajustes.',
  ocupado: 'Tu PC está con otra prueba. Espera a que acabe y vuelve a intentarlo.',
  grande: 'Las fotos pesan demasiado para tu PC (más de 20 MB).',
  peticion: 'Tu PC no ha entendido la petición: faltan la foto o las prendas.',
  imagen: 'Tu PC no ha podido abrir alguna foto (la tuya o la de una prenda). Prueba a cambiarla.',
  'no-existe': 'Tu PC ya no tiene esta prueba (¿se ha reiniciado?). Vuelve a pulsar «Pruébatelo».',
  prueba: 'La prueba ha fallado en tu PC. Mira la consola del probador.',
  servidor: 'Esa dirección no parece el probador de Percha. Revísala en Ajustes.',
}

/** Qué decirle al usuario cuando falla el probador del PC. */
export function mensajeProbador(fallo: unknown): string {
  return fallo instanceof ErrorProbador
    ? MENSAJES[fallo.motivo]
    : 'No se ha podido hablar con tu PC. Prueba otra vez.'
}
