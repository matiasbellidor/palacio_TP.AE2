"""Reparte el guion exacto de la exposición (de todos los oradores) entre las salas del palacio.

Uso (con el Python del proyecto del TP, que tiene sus dependencias):
    python tools/generar_guion.py --tp ../trabajo_practico_AE2

Lee guion/guion.yaml del TP (que no está en ningún repo) y outputs/resultados.json, arma el guion con los números ya
reemplazados (la misma función que usa Recursos) y escribe la parte «guiones» de contenido/guion.json, que
build.py incluye en la página (a la vista: el profesor no tiene el link). Las frases por estación de Mati («lineas») se conservan.

Cada sala dice qué pasos del guion le corresponden. Donde dos salas comparten una diapositiva (9 con la 7; 11 y 12 con
la 8), se reparte por párrafos.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent.parent
DESTINO = AQUI / "contenido" / "guion.json"

# sala -> [(id del bloque, id de la diapositiva, desde el párrafo, hasta el párrafo)]
SALAS = {
    1: [("apertura", "portada", 0, None), ("luka", "portada", 0, None)],
    2: [("luka", "hipotesis", 0, None)],
    3: [("luka", "figura-4", 0, None)],
    4: [("mati", "fuentes", 0, None)],
    5: [("mati", "figura-1", 0, None)],
    6: [("manu-1", "descriptiva", 0, None)],
    7: [("manu-1", "mco", 0, 3)],
    9: [("manu-1", "mco", 3, None)],
    10: [("maria", "sensibilidad", 0, None)],
    11: [("manu-2", "sensibilidad", 0, 2)],
    12: [("manu-2", "sensibilidad", 2, None)],
    14: [("meli", "agregacion", 0, None)],
    15: [("meli", "limitaciones", 0, None), ("meli", "conclusiones", 0, None), ("meli", "futuro", 0, None)],
}


def reloj(s: int) -> str:
    return f"{s // 60}:{s % 60:02d}"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--tp", type=Path, required=True)
    a = ap.parse_args()
    sys.path.insert(0, str(a.tp / "src"))
    from tp_ae2.pitch import deck, guion  # noqa: E402

    resultados = json.loads((a.tp / "outputs" / "resultados.json").read_text(encoding="utf-8"))
    fuente = guion.cargar(a.tp / "guion" / "guion.yaml")
    publicado = (a.tp / "docs" / "presentacion" / "index.html").read_text(encoding="utf-8")
    diapos = deck.diapositivas(publicado)
    armado = guion.armar(fuente, resultados, [d.id for d in diapos], {d.id: d.titulo for d in diapos})

    bloques = armado["bloques"]
    ultimo_de = {}
    for p in armado["pasos"]:
        ultimo_de[p["bloque"]] = p  # el último paso de cada bloque lleva el pase

    guiones: dict[str, list] = {}
    for sala, partes in SALAS.items():
        items = []
        for bloque_id, diapo, desde, hasta in partes:
            paso = next((p for p in armado["pasos"]
                         if bloques[p["bloque"]]["id"] == bloque_id and p["diapositiva"] == diapo), None)
            if paso is None:
                raise SystemExit(f"Sala {sala}: no hay un paso «{bloque_id}/{diapo}» en el guion")
            b = bloques[paso["bloque"]]
            lineas = paso["guion"][desde:hasta]
            marcas = paso.get("marcas", [])

            def cambiar(m: re.Match) -> str:
                k = int(m.group(1))
                return f"[señalá «{marcas[k - 1]['texto']}»]" if 1 <= k <= len(marcas) else ""

            lineas = [re.sub(r"\[señalar (\d+)\]", cambiar, l) for l in lineas]
            pase = b.get("pase") if ultimo_de[paso["bloque"]] is paso and hasta is None else None
            items.append({
                "orador": b["orador"], "etiqueta": b["etiqueta"], "tema": b["tema"],
                "tiempo": f"{reloj(paso['inicio'])} a {reloj(paso['inicio'] + paso['segundos'])} · {paso['segundos']} s",
                "como": paso.get("como", "") if desde == 0 else "",
                "lineas": lineas,
                "pase": {"a": armado["oradores"][pase["a"]]["nombre"], "frase": pase["frase"]} if pase else None,
            })
        guiones[str(sala)] = items

    previo = json.loads(DESTINO.read_text(encoding="utf-8")) if DESTINO.exists() else {}
    previo["guiones"] = guiones
    DESTINO.write_text(json.dumps(previo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(len(i["lineas"]) for v in guiones.values() for i in v)
    print(f"guiones de {len(guiones)} salas, {total} párrafos, duración total {armado['duracion_texto']} → {DESTINO.relative_to(AQUI)}")


if __name__ == "__main__":
    main()
