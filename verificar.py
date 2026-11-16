"""Verifica el palacio contra el trabajo y contra sí mismo.

Uso:
    python verificar.py [--tp ../trabajo_practico_AE2]

1. Cada cifra declarada en una estación (campo «cifras») tiene que aparecer tal cual en el README, la conclusión o el
   informe del TP. Todo número con coma decimal del campo «dato» también (los datos son exactos; las imágenes pueden
   redondear y solo avisan).
2. Las salas son consecutivas, los ids no se repiten y cada estación tiene sus campos.
3. Lo que dice Mati está marcado (dice) y tiene su frase textual en privado/guion_mati.json; cada sala con
   guion lo tiene en «guiones» (generado con tools/generar_guion.py).
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


def estaciones_de(sala: dict) -> list[dict]:
    return sala["estaciones"] + [e for x in sala.get("subsalas", []) for e in x["estaciones"]]


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
    # Orden real del deck publicado: cada sala dice qué diapositiva le corresponde (número e id)
    ids_deck: list[str] = []
    deck = a.tp / "docs" / "presentacion" / "index.html"
    m = re.search(r"window\.__PITCH__ = (\{.*?\});</script>", deck.read_text(encoding="utf-8")) if deck.exists() else None
    if m:
        ids_deck = [d["id"] for d in json.loads(m.group(1))["diapositivas"]]
    else:
        avisos.append("No encuentro el deck del TP: no se pudieron comprobar los números de diapositiva")
    salas = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((AQUI / "contenido" / "salas").glob("*.json"))]
    ids, total = set(), 0
    for i, s in enumerate(salas, start=1):
        if s["n"] != i:
            errores.append(f"Sala {i}: n = {s['n']}")
        if not s.get("idea"):
            errores.append(f"Sala {i}: falta la «idea» (qué es este cuarto)")
        if "conGuion" not in s or (s["conGuion"] is False and not s.get("sinGuion")):
            errores.append(f"Sala {i}: falta conGuion (y sinGuion si no tiene guion)")
        nums, dids = s.get("diapositivas"), s.get("diapositivasId")
        if nums is None or dids is None or len(nums) != len(dids):
            errores.append(f"Sala {i}: falta diapositivas / diapositivasId (o no tienen el mismo largo)")
        else:
            if not nums and not s.get("diapositivaNota"):
                errores.append(f"Sala {i}: sin diapositiva propia necesita una diapositivaNota")
            for n, d in zip(nums, dids):
                if ids_deck and (not 1 <= n <= len(ids_deck) or ids_deck[n - 1] != d):
                    errores.append(f"Sala {i}: la diapositiva {n} no es «{d}» en el deck del TP")
        for campo in ("nombre", "tema", "quien", "historia", "puerta", "estaciones"):
            if not s.get(campo):
                errores.append(f"Sala {i}: falta {campo}")
        if i not in (4, 5) and any(e.get("dice") for e in s["estaciones"]) and i != 1:
            errores.append(f"Sala {i}: tiene estaciones que dice Mati y no es la 1, 4 ni 5")
        for x in s.get("subsalas", []):
            for campo in ("id", "etiqueta", "nombre", "tema", "lugar", "historia", "puerta", "estaciones"):
                if not x.get(campo):
                    errores.append(f"Sala {i}, sub-sala {x.get('id', '?')}: falta {campo}")
        for e in estaciones_de(s):
            total += 1
            for campo in CAMPOS + ("significa",):
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
        contenido_priv = json.loads(priv.read_text(encoding="utf-8"))
        lineas = contenido_priv["lineas"]
        guiones = contenido_priv.get("guiones", {})
        con_guion = {str(s["n"]) for s in salas if s.get("conGuion")}
        if con_guion != set(guiones):
            errores.append(f"Las salas con guion y el guion privado no coinciden: {sorted(con_guion ^ set(guiones))}")
        for n, items in guiones.items():
            for it in items:
                if not it.get("lineas"):
                    errores.append(f"Guion de la sala {n}: «{it.get('etiqueta')}» sin líneas")
        dicen = {e["id"] for s in salas for e in s["estaciones"] if e.get("dice") and e["id"][:2] in ("r4", "r5")}
        if dicen != set(lineas):
            errores.append(f"Guion privado y estaciones violetas no coinciden: {sorted(dicen ^ set(lineas))}")
        plano = normalizar(html)
        todo = list(lineas.items()) + [(f"sala {n}", it["lineas"]) for n, its in guiones.items() for it in its]
        for k, ls in todo:
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
