export type Motor = 'webgpu' | 'wasm';

export type Recortador = {
  /** Devuelve un PNG con el fondo transparente, al tamaño de la entrada. */
  recortar(entrada: HTMLCanvasElement): Promise<Blob>;
  dtype: string;
};

export type Candidato = {
  id: string;
  nombre: string;
  modelo: string;
  licencia: string;
  cargar(motor: Motor, f16: boolean): Promise<Recortador>;
};

// Pesos de cada modelo según el motor: q8 en WASM porque pesa la cuarta parte; fp16 en WebGPU si el
// móvil tiene `shader-f16`.
type Pesos = { webgpu16: string; webgpu32: string; wasm: string };

function elegirDtype(pesos: Pesos, motor: Motor, f16: boolean): string {
  if (motor === 'wasm') return pesos.wasm;
  return f16 ? pesos.webgpu16 : pesos.webgpu32;
}

function canvasABlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob devolvió null'))), 'image/png'),
  );
}

function conPipeline(
  id: string,
  nombre: string,
  modelo: string,
  licencia: string,
  pesos: Pesos | null,
  extra: Record<string, unknown> = {},
): Candidato {
  return {
    id,
    nombre,
    modelo,
    licencia,
    async cargar(motor, f16) {
      const { pipeline, RawImage } = await import('@huggingface/transformers');
      if (!pesos && motor === 'wasm') throw new Error(`${nombre} solo funciona con WebGPU`);
      const dtype = pesos ? elegirDtype(pesos, motor, f16) : 'fp16';
      const segmentar = await pipeline('background-removal', modelo, {
        device: motor,
        dtype: dtype as 'fp32',
        ...extra,
      });
      return {
        dtype,
        async recortar(entrada) {
          const salida = await segmentar(RawImage.fromCanvas(entrada));
          return canvasABlob(salida.toCanvas());
        },
      };
    },
  };
}

// RMBG-1.4 no trae `model_type` estándar: se carga como en su ficha de Hugging Face, con modelo y
// procesador a mano, y la máscara se aplica en un canvas.
const rmbg14: Candidato = {
  id: 'rmbg14',
  nombre: 'Transformers.js + RMBG-1.4',
  modelo: 'briaai/RMBG-1.4',
  licencia: 'bria-rmbg-1.4 (CC BY-NC 4.0): gratis solo para uso no comercial',
  async cargar(motor, f16) {
    const { AutoModel, AutoProcessor, RawImage } = await import('@huggingface/transformers');
    const dtype = elegirDtype({ webgpu16: 'fp16', webgpu32: 'fp32', wasm: 'q8' }, motor, f16);
    const model = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
      config: { model_type: 'custom' } as never,
      device: motor,
      dtype: dtype as 'fp32',
    });
    const processor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
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
    } as never);
    return {
      dtype,
      async recortar(entrada) {
        const imagen = RawImage.fromCanvas(entrada);
        const { pixel_values } = await processor(imagen);
        const { output } = await model({ input: pixel_values });
        const mascara = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(
          imagen.width,
          imagen.height,
        );
        const lienzo = document.createElement('canvas');
        lienzo.width = imagen.width;
        lienzo.height = imagen.height;
        const ctx = lienzo.getContext('2d')!;
        ctx.drawImage(entrada, 0, 0);
        const pixeles = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
        for (let i = 0; i < mascara.data.length; i++) pixeles.data[4 * i + 3] = mascara.data[i];
        ctx.putImageData(pixeles, 0, 0);
        return canvasABlob(lienzo);
      },
    };
  },
};

const rembgWebgpu: Candidato = {
  id: 'rembg',
  nombre: 'rembg-webgpu 0.2.1',
  modelo: 'briaai/RMBG-1.4 (lo carga la librería por dentro)',
  licencia:
    'Librería: RemBG Attribution License (tipo MIT, pide crédito visible). Modelo: bria-rmbg-1.4 (CC BY-NC 4.0)',
  async cargar(motor) {
    if (motor === 'wasm') {
      // La librería elige el motor sola: para forzar WASM se esconde WebGPU antes de cargarla.
      Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
    }
    const rembg = await import('rembg-webgpu');
    const capacidad = await rembg.getCapabilities();
    await rembg.init();
    return {
      dtype: capacidad.dtype,
      async recortar(entrada) {
        const url = URL.createObjectURL(await canvasABlob(entrada));
        try {
          const r = await rembg.removeBackground(url);
          const blob = await (await fetch(r.blobUrl)).blob();
          URL.revokeObjectURL(r.blobUrl);
          URL.revokeObjectURL(r.previewUrl);
          return blob;
        } finally {
          URL.revokeObjectURL(url);
        }
      },
    };
  },
};

export const candidatos: Candidato[] = [
  rembgWebgpu,
  rmbg14,
  conPipeline(
    'birefnet',
    'Transformers.js + BiRefNet lite',
    'onnx-community/BiRefNet_lite-ONNX',
    'MIT: sin restricciones',
    // Solo hay fp32 y fp16; en WASM se usa fp32 (224 MB).
    { webgpu16: 'fp16', webgpu32: 'fp32', wasm: 'fp32' },
  ),
  conPipeline(
    'birefnet1024',
    'Transformers.js + BiRefNet lite 1024 (parcheado WebGPU)',
    'jiabins0303/birefnet-lite-1024-webgpu',
    'MIT: sin restricciones',
    // Solo existe el fichero fp16 y solo corre en WebGPU: se pide «fp32» para que no añada sufijo.
    null,
    { dtype: 'fp32', model_file_name: 'model_fp16' },
  ),
  conPipeline(
    'isnet',
    'Transformers.js + ISNet (DIS)',
    'onnx-community/ISNet-ONNX',
    'Ficha de HF: AGPL-3.0 (el repo original DIS es Apache-2.0). Uso personal: sin problema',
    { webgpu16: 'fp16', webgpu32: 'fp32', wasm: 'q8' },
  ),
  conPipeline(
    'mvanet',
    'Transformers.js + MVANet',
    'onnx-community/MVANet-ONNX',
    'MIT: sin restricciones',
    { webgpu16: 'q4f16', webgpu32: 'q4', wasm: 'q4' },
  ),
];
