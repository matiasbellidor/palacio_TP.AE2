"""Arma index.html (un solo archivo, sin pedidos externos) con el palacio mental.

Uso:
    python build.py                       # reutiliza el juego cifrado que ya está en index.html
    python build.py --codigo NNN          # vuelve a cifrar privado/quiz_mati.json con ese código de 3 dígitos

Junta contenido/meta.json, contenido/salas/*.json y contenido/guion.json (el guion exacto de cada persona, generado con
tools/generar_guion.py) en una página única. El guion va a la vista: el palacio es material de estudio del grupo y el
profesor no tiene el link.

El juego para practicar la parte de Mati (privado/quiz_mati.json, que NO se sube al repo) se publica cifrado con
AES-GCM y una clave PBKDF2 del código: el código no figura en ningún archivo del repo y la página no lo recuerda. No es
seguridad fuerte (con 3 dígitos se pueden probar las 1000 combinaciones): sirve para que las preguntas no queden a la
vista. El cifrado necesita Playwright con Chromium (cifra con la misma WebCrypto que después descifra el navegador).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).parent
sys.path.insert(0, str(AQUI / "tools"))
SALIDA = AQUI / "index.html"
PRIVADO = AQUI / "privado" / "quiz_mati.json"


def estaciones_de(sala: dict) -> list[dict]:
    """Las estaciones de la sala y las de sus sub-salas."""
    return sala["estaciones"] + [e for x in sala.get("subsalas", []) for e in x["estaciones"]]


def cargar_contenido() -> dict:
    meta = json.loads((AQUI / "contenido" / "meta.json").read_text(encoding="utf-8"))
    salas = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((AQUI / "contenido" / "salas").glob("*.json"))]
    for i, s in enumerate(salas, start=1):
        if s["n"] != i:
            raise SystemExit(f"Las salas tienen que ser consecutivas: el archivo {i} trae n = {s['n']}")
    ids = [e["id"] for s in salas for e in estaciones_de(s)]
    if len(ids) != len(set(ids)):
        raise SystemExit("Hay ids de estación repetidos")
    ruta_guion = AQUI / "contenido" / "guion.json"
    if not ruta_guion.exists():
        raise SystemExit("Falta contenido/guion.json: correr python tools/generar_guion.py --tp <carpeta del TP>")
    return {"meta": meta, "salas": salas, "guion": json.loads(ruta_guion.read_text(encoding="utf-8"))}


def cifrado_previo() -> str:
    if not SALIDA.exists():
        return "{}"
    m = re.search(r'id="quiz-cifrado">(.*?)</script>', SALIDA.read_text(encoding="utf-8"), re.S)
    return m.group(1) if m else "{}"


def cifrar(codigo: str) -> str:
    from cifrar_json import cifrar as _cifrar

    contenido = json.loads(PRIVADO.read_text(encoding="utf-8"))
    texto = json.dumps(contenido, ensure_ascii=False, separators=(",", ":"))
    return json.dumps(_cifrar(texto, codigo))


def en_script(texto: str) -> str:
    # "</" escapado: un texto con "</script>" no puede cortar el bloque de datos
    return texto.replace("</", r"<\/")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--codigo", help="3 dígitos; vuelve a cifrar el juego (privado/quiz_mati.json)")
    a = ap.parse_args()

    datos = cargar_contenido()
    if a.codigo:
        if not a.codigo.isdigit() or len(a.codigo) != 3:
            raise SystemExit("El código son 3 dígitos")
        if not PRIVADO.exists():
            raise SystemExit(f"Falta {PRIVADO.relative_to(AQUI)} (no se sube al repo)")
        cifrado = cifrar(a.codigo)
    else:
        cifrado = cifrado_previo()

    plantilla = (AQUI / "src" / "plantilla.html").read_text(encoding="utf-8")
    html = (plantilla
            .replace("/*CSS*/", (AQUI / "src" / "estilos.css").read_text(encoding="utf-8"))
            .replace("/*DATOS*/", en_script(json.dumps(datos, ensure_ascii=False, separators=(",", ":"))))
            .replace("/*QUIZ*/", en_script(cifrado))
            .replace("/*CODIGO*/", (AQUI / "src" / "codigo-casillas.js").read_text(encoding="utf-8"))
            .replace("/*JUEGO*/", (AQUI / "src" / "juego.js").read_text(encoding="utf-8"))
            .replace("/*APP*/", (AQUI / "src" / "app.js").read_text(encoding="utf-8")))
    SALIDA.write_text(html, encoding="utf-8", newline="\n")
    estaciones = sum(len(estaciones_de(s)) for s in datos["salas"])
    bloques = sum(len(v) for v in datos["guion"].get("guiones", {}).values())
    print(f"index.html: {len(html) / 1024:.0f} KB, {len(datos['salas'])} salas, {estaciones} estaciones, {bloques} bloques de guion, "
          f"juego {'cifrado de nuevo' if a.codigo else 'reutilizado' if cifrado != '{}' else 'AUSENTE'}")


if __name__ == "__main__":
    main()
