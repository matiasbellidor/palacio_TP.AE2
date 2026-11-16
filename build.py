"""Arma index.html (un solo archivo, sin pedidos externos) con el palacio mental.

Uso:
    python build.py

Junta contenido/meta.json, contenido/salas/*.json y contenido/guion.json (el guion exacto de cada persona, generado con
tools/generar_guion.py) en una página única. El guion va a la vista: el palacio es material de estudio del grupo y el
profesor no tiene el link.
"""

from __future__ import annotations

import json
from pathlib import Path

AQUI = Path(__file__).parent
SALIDA = AQUI / "index.html"


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


def en_script(texto: str) -> str:
    # "</" escapado: un texto con "</script>" no puede cortar el bloque de datos
    return texto.replace("</", r"<\/")


def main() -> None:
    datos = cargar_contenido()
    plantilla = (AQUI / "src" / "plantilla.html").read_text(encoding="utf-8")
    html = (plantilla
            .replace("/*CSS*/", (AQUI / "src" / "estilos.css").read_text(encoding="utf-8"))
            .replace("/*DATOS*/", en_script(json.dumps(datos, ensure_ascii=False, separators=(",", ":"))))
            .replace("/*APP*/", (AQUI / "src" / "app.js").read_text(encoding="utf-8")))
    SALIDA.write_text(html, encoding="utf-8", newline="\n")
    estaciones = sum(len(estaciones_de(s)) for s in datos["salas"])
    bloques = sum(len(v) for v in datos["guion"].get("guiones", {}).values())
    print(f"index.html: {len(html) / 1024:.0f} KB, {len(datos['salas'])} salas, {estaciones} estaciones, "
          f"{bloques} bloques de guion")


if __name__ == "__main__":
    main()
