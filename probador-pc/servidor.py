"""Servidor del probador de Percha en el PC del usuario (CatVTON en la GPU).

Escucha solo en 127.0.0.1; `tailscale serve` lo publica para los dispositivos del usuario. El contrato está en
`docs/probador-pc.md`. Las fotos no se guardan en disco: viven en memoria hasta una hora.
"""

import io
import os
import secrets
import sys
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from PIL import Image

CARPETA_VTON = Path(os.environ.get("PERCHA_VTON_DIR", Path.home() / "proyectos" / "Percha-vton"))
os.environ.setdefault("HF_HOME", str(CARPETA_VTON / "hf"))
sys.path.insert(0, str(CARPETA_VTON / "catvton"))

from fashn_human_parser import LABELS_TO_IDS, FashnHumanParser  # noqa: E402
from model.pipeline import CatVTONPipeline  # noqa: E402

ORIGENES = ["https://percha.joaquinjesusbeltrangarcia.workers.dev", "http://localhost:5173"]
MAX_BYTES = 20 * 1024 * 1024
VIDA_SEGUNDOS = 3600
ANCHO, ALTO = 768, 1024
ZONAS = {
    "arriba": ["top", "dress", "scarf", "torso", "arms"],
    # Las piernas entran para que un pantalón largo tape lo que deja ver una bermuda.
    "abajo": ["pants", "skirt", "belt", "legs"],
    "entero": ["top", "dress", "scarf", "torso", "arms", "pants", "skirt", "belt", "legs"],
}
PROTEGIDAS = ["face", "hair", "hands"]


def leer_clave() -> str:
    """La clave se crea la primera vez y se guarda fuera del repo, en el perfil del usuario."""
    ruta = Path(os.environ.get("APPDATA", Path.home())) / "percha-probador" / "clave.txt"
    if not ruta.exists():
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(secrets.token_urlsafe(32), encoding="utf-8")
    return ruta.read_text(encoding="utf-8").strip()


CLAVE = leer_clave()


@dataclass
class Prueba:
    total: int
    estado: str = "en-cola"
    hechas: int = 0
    error: str | None = None
    imagen: bytes | None = None
    creada: float = field(default_factory=time.time)
    empezada: float | None = None


pruebas: dict[str, Prueba] = {}
cerrojo = threading.Lock()
modelos: dict[str, object] = {}


def cargar_modelos() -> tuple[CatVTONPipeline, FashnHumanParser]:
    if not modelos:
        modelos["parser"] = FashnHumanParser(device="cuda")
        modelos["vton"] = CatVTONPipeline(
            base_ckpt="booksforcharlie/stable-diffusion-inpainting",
            attn_ckpt="zhengchong/CatVTON",
            attn_ckpt_version="mix",
            weight_dtype=torch.bfloat16,
            skip_safety_check=True,
            device="cuda",
        )
    return modelos["vton"], modelos["parser"]  # type: ignore[return-value]


def a_rgb(datos: bytes) -> Image.Image:
    imagen = Image.open(io.BytesIO(datos))
    if imagen.mode in ("RGBA", "LA", "P"):
        imagen = imagen.convert("RGBA")
        fondo = Image.new("RGB", imagen.size, "white")
        fondo.paste(imagen, mask=imagen.getchannel("A"))
        return fondo
    return imagen.convert("RGB")


def mascara(parser: FashnHumanParser, persona: Image.Image, zona: str) -> Image.Image:
    etiquetas = parser.predict(persona)
    if etiquetas.shape != (persona.height, persona.width):
        etiquetas = cv2.resize(etiquetas.astype(np.uint8), persona.size, interpolation=cv2.INTER_NEAREST)
    zona_ids = [LABELS_TO_IDS[n] for n in ZONAS[zona]]
    m = np.isin(etiquetas, zona_ids).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((15, 15), np.uint8), iterations=2)
    m[np.isin(etiquetas, [LABELS_TO_IDS[n] for n in PROTEGIDAS])] = 0
    return Image.fromarray(m)


def probar(id_: str, persona: Image.Image, prendas: list[tuple[Image.Image, str]]) -> None:
    prueba = pruebas[id_]
    try:
        vton, parser = cargar_modelos()
        prueba.estado = "probando"
        prueba.empezada = time.time()
        actual = persona
        for prenda, zona in prendas:
            actual = vton(
                image=actual,
                condition_image=prenda,
                mask=mascara(parser, actual, zona),
                num_inference_steps=50,
                guidance_scale=2.5,
                height=ALTO,
                width=ANCHO,
                generator=torch.Generator(device="cuda").manual_seed(42),
            )[0]
            prueba.hechas += 1
        salida = io.BytesIO()
        actual.save(salida, format="JPEG", quality=90)
        prueba.imagen = salida.getvalue()
        prueba.estado = "lista"
    except Exception as error:  # noqa: BLE001 - cualquier fallo se cuenta a la app, no tumba el servidor
        prueba.estado = "error"
        prueba.error = str(error)[:200]
    finally:
        cerrojo.release()


def limpiar() -> None:
    ahora = time.time()
    for id_ in [i for i, p in pruebas.items() if ahora - p.creada > VIDA_SEGUNDOS]:
        del pruebas[id_]


app = FastAPI(title="Probador de Percha", docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(HTTPException)
async def error_plano(_: Request, error: HTTPException) -> JSONResponse:
    # El contrato pide {"error": "..."}, no el {"detail": ...} de FastAPI.
    cuerpo = error.detail if isinstance(error.detail, dict) else {"error": str(error.detail)}
    return JSONResponse(cuerpo, status_code=error.status_code)


@app.middleware("http")
async def comprobar(request: Request, siguiente):
    if request.method != "OPTIONS":
        if request.headers.get("authorization") != f"Bearer {CLAVE}":
            return JSONResponse({"error": "clave"}, status_code=401)
        if int(request.headers.get("content-length") or 0) > MAX_BYTES:
            return JSONResponse({"error": "grande"}, status_code=413)
    respuesta = await siguiente(request)
    return respuesta


# CORS va por fuera de la clave: las preflight no llevan Authorization.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
    allow_private_network=True,
    max_age=600,
)


@app.get("/salud")
def salud() -> dict:
    return {"ok": True, "modelo": "catvton", "version": 1, "ocupado": cerrojo.locked()}


@app.post("/pruebas", status_code=202)
async def crear(
    persona: UploadFile | None = File(None),
    prenda: list[UploadFile] | None = File(None),
    zona: list[str] | None = Form(None),
) -> dict:
    if persona is None:
        raise HTTPException(400, {"error": "sin-persona"})
    if not prenda:
        raise HTTPException(400, {"error": "sin-prendas"})
    if not zona or len(zona) != len(prenda) or any(z not in ZONAS for z in zona):
        raise HTTPException(400, {"error": "zona"})
    if not cerrojo.acquire(blocking=False):
        raise HTTPException(409, {"error": "ocupado"})
    try:
        foto = a_rgb(await persona.read())
        prendas = [(a_rgb(await p.read()), z) for p, z in zip(prenda, zona)]
    except Exception:
        cerrojo.release()
        raise HTTPException(400, {"error": "imagen"}) from None
    limpiar()
    id_ = str(uuid.uuid4())
    pruebas[id_] = Prueba(total=len(prendas))
    threading.Thread(target=probar, args=(id_, foto, prendas), daemon=True).start()
    return {"id": id_, "total": len(prendas)}


@app.get("/pruebas/{id_}")
def estado(id_: str) -> dict:
    prueba = pruebas.get(id_)
    if prueba is None:
        raise HTTPException(404, {"error": "no-existe"})
    segundos = int(time.time() - prueba.empezada) if prueba.empezada else 0
    return {
        "estado": prueba.estado,
        "hechas": prueba.hechas,
        "total": prueba.total,
        "segundos": segundos,
        "error": prueba.error,
    }


@app.get("/pruebas/{id_}/imagen")
def imagen(id_: str) -> Response:
    prueba = pruebas.get(id_)
    if prueba is None or prueba.imagen is None:
        raise HTTPException(404, {"error": "no-lista"})
    return Response(prueba.imagen, media_type="image/jpeg")


if __name__ == "__main__":
    import uvicorn

    print(f"Probador de Percha en http://127.0.0.1:7861\nClave para Percha › Ajustes: {CLAVE}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=7861, log_level="warning")
