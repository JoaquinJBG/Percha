/** `AAAA-MM-DD` en hora local, no en UTC (de madrugada `toISOString()` da el día anterior). */
export function fechaLocal(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${String(fecha.getFullYear())}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}
