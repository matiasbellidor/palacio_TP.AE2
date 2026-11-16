"""Verifica el palacio contra el trabajo y contra sí mismo.

Uso:
    python verificar.py [--tp ../trabajo_practico_AE2]

1. Cada cifra declarada en una estación (campo «cifras») tiene que aparecer tal cual en el README, la conclusión o el
   informe del TP. Todo número con coma decimal del campo «dato» también (los datos son exactos; las imágenes pueden
   redondear y solo avisan).
2. Las salas son consecutivas, los ids no se repiten y cada estación tiene sus campos.
3. Lo que dice Mati está marcado (dice) y tiene su frase textual en privado/guion_mati.json.
4. El guion textual NO está en texto plano en index.html (se buscan frases reales, no marcas del intérprete).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).parent
CAMPOS = ("id", "lugar", "imagen", "frase", "dato", "cifras")
DECIMAL = re.compile(r"(?<![\w.])[−+-]?\d{1,3}(?:\.\d{3})*,\d+")


def normalizar(t: str) -> str:
    return re.sub(r"\s+", " ", t.replace("*", "")).strip().lower()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--tp", type=Path, default=AQUI.parent / "trabajo_practico_AE2")
    a = ap.parse_args()

    fuentes = [a.tp / "README.md", a.tp / "conclusion" / "conclusion.md", a.tp / "reports" / "cuerpo_informe.md"]
    faltan = [str(f) for f in fuentes if not f.exists()]
    if faltan:
        print("No encuentro el TP:", ", ".join(faltan))
        return 2
    corpus = "\n".join(f.read_text(encoding="utf-8") for f in fuentes)

    errores, avisos = [], []
    salas = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((AQUI / "contenido" / "salas").glob("*.json"))]
    ids, total = set(), 0
    for i, s in enumerate(salas, start=1):
        if s["n"] != i:
            errores.append(f"Sala {i}: n = {s['n']}")
        for campo in ("nombre", "tema", "quien", "historia", "puerta", "estaciones"):
            if not s.get(campo):
                errores.append(f"Sala {i}: falta {campo}")
        if i not in (4, 5) and any(e.get("dice") for e in s["estaciones"]) and i != 1:
            errores.append(f"Sala {i}: tiene estaciones que dice Mati y no es la 1, 4 ni 5")
        for e in s["estaciones"]:
            total += 1
            for campo in CAMPOS:
                if campo not in e:
                    errores.append(f"{e.get('id', '?')}: falta {campo}")
            if e["id"] in ids:
                errores.append(f"{e['id']}: id repetido")
            ids.add(e["id"])
            for c in e.get("cifras", []):
                if c not in corpus:
                    errores.append(f"{e['id']}: la cifra «{c}» no está en el TP")
            for n in DECIMAL.findall(e["dato"]):
                if n not in corpus:
                    errores.append(f"{e['id']}: «{n}» (en el dato) no está en el TP")
            for n in DECIMAL.findall(e["imagen"]):
                if n not in corpus:
                    avisos.append(f"{e['id']}: «{n}» (en la imagen) es un redondeo o no está en el TP")

    # Lo que dice Mati
    priv = AQUI / "privado" / "guion_mati.json"
    html = (AQUI / "index.html").read_text(encoding="utf-8") if (AQUI / "index.html").exists() else ""
    if priv.exists():
        lineas = json.loads(priv.read_text(encoding="utf-8"))["lineas"]
        dicen = {e["id"] for s in salas for e in s["estaciones"] if e.get("dice") and e["id"][:2] in ("r4", "r5")}
        if dicen != set(lineas):
            errores.append(f"Guion privado y estaciones violetas no coinciden: {sorted(dicen ^ set(lineas))}")
        plano = normalizar(html)
        for k, ls in lineas.items():
            for l in ls:
                limpia = normalizar(re.sub(r"\[pausa [^\]]*\]", "", l))
                if len(limpia) > 25 and (limpia in plano or " ".join(limpia.split()[:7]) in plano):
                    errores.append(f"{k}: el guion textual aparece en texto plano en index.html")
    else:
        avisos.append("No está privado/guion_mati.json (no se pudo comprobar el guion textual)")
    if html and '"datos"' not in re.search(r'id="guion-cifrado">(.*?)</script>', html, re.S).group(1):
        avisos.append("index.html no trae guion cifrado")

    print(f"{len(salas)} salas, {total} estaciones, {len(corpus):,} caracteres de TP leídos".replace(",", "."))
    for av in avisos:
        print("AVISO ", av)
    for er in errores:
        print("ERROR ", er)
    print("OK" if not errores else f"{len(errores)} errores")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
