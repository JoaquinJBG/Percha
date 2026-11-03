import {
  AutoModel,
  AutoProcessor,
  RawImage,
  type PreTrainedModel,
  type Processor,
  type ProgressInfo,
  type Tensor,
} from '@huggingface/transformers'
import type { ProgresoCarga } from './tipos.ts'

// Solo se usa dentro del worker: importa Transformers.js, que pesa medio mega.

const MODELO = 'briaai/RMBG-1.4'

interface Motor {
  device: 'webgpu' | 'wasm'
  dtype: 'fp16' | 'fp32' | 'q8'
}

interface Cargado {
  modelo: PreTrainedModel
  procesador: Processor
}

interface NavegadorConGPU {
  gpu?: { requestAdapter(): Promise<{ features: ReadonlySet<string> } | null> }
}

/** WebGPU primero (fp16 si la GPU lo admite) y WASM q8 de respaldo: pesa la mitad y recorta igual. */
async function motoresPosibles(): Promise<Motor[]> {
  const wasm: Motor = { device: 'wasm', dtype: 'q8' }
  try {
    const adaptador = await (navigator as NavegadorConGPU).gpu?.requestAdapter()
    if (!adaptador) return [wasm]
    const dtype = adaptador.features.has('shader-f16') ? 'fp16' : 'fp32'
    return [{ device: 'webgpu', dtype }, wasm]
  } catch {
    return [wasm]
  }
}

async function cargarCon(
  motor: Motor,
  avisar: (progreso: ProgresoCarga) => void,
): Promise<Cargado> {
  // Transformers.js avisa fichero a fichero: se suman para dar una sola barra.
  const ficheros = new Map<string, ProgresoCarga>()
  const progress_callback = (info: ProgressInfo) => {
    if (info.status !== 'progress') return
    ficheros.set(info.file, { cargados: info.loaded, total: info.total })
    let cargados = 0
    let total = 0
    for (const fichero of ficheros.values()) {
      cargados += fichero.cargados
      total += fichero.total
    }
    avisar({ cargados, total })
  }

  // RMBG-1.4 no trae un `model_type` estándar: se carga como en su ficha de Hugging Face.
  const modelo = await AutoModel.from_pretrained(MODELO, {
    config: { model_type: 'custom' } as never,
    device: motor.device,
    dtype: motor.dtype,
    progress_callback,
  })
  const procesador = await AutoProcessor.from_pretrained(MODELO, {
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      feature_extractor_type: 'ImageFeatureExtractor',
      image_std: [1, 1, 1],
      resample: 2,
      rescale_factor: 0.00392156862745098,
      size: { width: 1024, height: 1024 },
    },
    progress_callback,
  })
  return { modelo, procesador }
}

let carga: Promise<Cargado> | null = null

/** Carga el modelo una vez por worker. Si falla, se olvida para poder reintentarlo. */
export function cargarModelo(avisar: (progreso: ProgresoCarga) => void): Promise<Cargado> {
  carga ??= (async () => {
    let ultimoError: unknown = null
    for (const motor of await motoresPosibles()) {
      try {
        const cargado = await cargarCon(motor, avisar)
        console.info(`Recorte con ${motor.device} · ${motor.dtype}`)
        return cargado
      } catch (error) {
        console.warn(`No se pudo cargar el recorte con ${motor.device}`, error)
        ultimoError = error
      }
    }
    throw ultimoError
  })()
  carga.catch(() => {
    carga = null
  })
  return carga
}

export async function recortarFoto(
  foto: Blob,
  avisar: (progreso: ProgresoCarga) => void,
): Promise<Blob> {
  const { modelo, procesador } = await cargarModelo(avisar)

  const mapa = await createImageBitmap(foto)
  const { width, height } = mapa
  const lienzo = new OffscreenCanvas(width, height)
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('Sin contexto 2D')
  ctx.drawImage(mapa, 0, 0)
  mapa.close()
  const pixeles = ctx.getImageData(0, 0, width, height)

  const imagen = new RawImage(pixeles.data, width, height, 4)
  const { pixel_values } = (await procesador(imagen)) as { pixel_values: Tensor }
  const { output } = (await modelo({ input: pixel_values })) as { output: Tensor[] }
  const salida = output[0]
  if (!salida) throw new Error('El modelo no ha devuelto máscara')
  const mascara = await RawImage.fromTensor(salida.mul(255).to('uint8')).resize(width, height)

  for (let i = 0; i < mascara.data.length; i++) pixeles.data[4 * i + 3] = mascara.data[i] ?? 0
  ctx.putImageData(pixeles, 0, 0)
  return lienzo.convertToBlob({ type: 'image/png' })
}
