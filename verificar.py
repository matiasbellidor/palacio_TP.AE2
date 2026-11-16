"""Verifica el palacio contra el trabajo y contra sí mismo.

Uso:
    python verificar.py [--tp ../trabajo_practico_AE2]

1. Cada cifra declarada en una estación (campo «cifras») tiene que aparecer tal cual en el README, la conclusión o el
   informe del TP. Todo número con coma decimal del campo «dato» también (los datos son exactos; las imágenes pueden
   redondear y solo avisan).
2. Las salas son consecutivas, los ids no se repiten y cada estación tiene sus campos.
3. Lo que dice Mati está marcado (dice) y tiene su frase textual en contenido/guion.json; cada sala con guion lo
   tiene en «guiones» (generado con tools/generar_guion.py).
4. index.html no trae el guion cifrado de la versión anterior (ahora el guion está a la vista).
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

    # Guion exacto de cada persona (contenido/guion.json): repartido entre las salas con guion
    ruta_guion = AQUI / "contenido" / "guion.json"
    if not ruta_guion.exists():
        errores.append("Falta contenido/guion.json (python tools/generar_guion.py --tp <carpeta del TP>)")
    else:
        g = json.loads(ruta_guion.read_text(encoding="utf-8"))
        lineas = g.get("lineas", {})
        guiones = g.get("guiones", {})
        con_guion = {str(s["n"]) for s in salas if s.get("conGuion")}
        if con_guion != set(guiones):
            errores.append(f"Las salas con guion y contenido/guion.json no coinciden: {sorted(con_guion ^ set(guiones))}")
        for n, items in guiones.items():
            for it in items:
                if not it.get("lineas") or not it.get("etiqueta"):
                    errores.append(f"Guion de la sala {n}: bloque sin etiqueta o sin líneas")
        dicen = {e["id"] for s in salas for e in s["estaciones"] if e.get("dice") and e["id"][:2] in ("r4", "r5")}
        if dicen != set(lineas):
            errores.append(f"Las frases de Mati y las estaciones violetas no coinciden: {sorted(dicen ^ set(lineas))}")
        html = (AQUI / "index.html").read_text(encoding="utf-8") if (AQUI / "index.html").exists() else ""
        if html and "guion-cifrado" in html:
            errores.append("index.html todavía tiene el bloque del guion cifrado")
        sin_marcas = [n for n, its in guiones.items() for it in its for l in it["lineas"] if re.search(r"\[señalar \d+\]", l)]
        if sin_marcas:
            errores.append(f"Marcas «[señalar N]» sin convertir en las salas {sorted(set(sin_marcas))}")

    # Juego de la parte de Mati (privado/quiz_mati.json, publicado cifrado): solo con frases de su guion
    quiz_json = AQUI / "privado" / "quiz_mati.json"
    if quiz_json.exists() and ruta_guion.exists():
        qs = json.loads(quiz_json.read_text(encoding="utf-8"))["preguntas"]
        guiones_q = json.loads(ruta_guion.read_text(encoding="utf-8")).get("guiones", {})
        quitar = lambda s: re.sub(r"\[[^\]]*\]", " ", s)  # noqa: E731
        its = [it for n in sorted(guiones_q, key=int) for it in guiones_q[n]]
        # las líneas de cada bloque y, al final, la frase del pase (que se guarda aparte)
        lineas_de = lambda it: it["lineas"] + ([it["pase"]["frase"]] if it.get("pase") else [])  # noqa: E731
        texto_todo = normalizar(" ".join(quitar(l) for it in its for l in lineas_de(it)))
        texto_mati = normalizar(" ".join(quitar(l) for it in its if it["orador"] == "mati" for l in lineas_de(it)))
        por_tipo: dict[str, int] = {}
        por_tipo_mati: dict[str, int] = {}
        vistos: set[str] = set()
        for q in qs:
            por_tipo[q.get("tipo", "?")] = por_tipo.get(q.get("tipo", "?"), 0) + 1
            for campo in ("id", "tipo", "texto", "explicacion", "guion"):
                if not q.get(campo):
                    errores.append(f"Pregunta {q.get('id', '?')}: falta {campo}")
            if q.get("id") in vistos:
                errores.append(f"Pregunta {q.get('id')}: id repetido")
            vistos.add(q.get("id"))
            if q.get("tipo") == "vf" and not isinstance(q.get("correcta"), bool):
                errores.append(f"{q.get('id')}: «correcta» tiene que ser true o false")
            if q.get("tipo") == "mc" and (len(q.get("opciones", [])) != 4 or len(set(q.get("opciones", []))) != 4
                                          or not isinstance(q.get("correcta"), int) or not 0 <= q["correcta"] < 4):
                errores.append(f"{q.get('id')}: una opción múltiple lleva 4 opciones distintas y el índice de la correcta")
            if q.get("tipo") == "completar" and (q.get("texto", "").count("___") != 1 or not q.get("respuestas")):
                errores.append(f"{q.get('id')}: completar lleva un solo «___» y las respuestas aceptadas")
            piezas = [x for x in q.get("guion", "").split(" … ") if x]
            for trozo in piezas:
                if normalizar(quitar(trozo)) not in texto_todo:
                    errores.append(f"{q.get('id')}: esta frase no está en el guion: «{trozo}»")
            if piezas and normalizar(quitar(piezas[0])) in texto_mati:
                por_tipo_mati[q.get("tipo", "?")] = por_tipo_mati.get(q.get("tipo", "?"), 0) + 1
        tipos = {"vf", "completar", "mc"}
        if set(por_tipo) != tipos or min(por_tipo.values()) < 20:
            errores.append(f"«Todo el trabajo» necesita al menos 20 preguntas de cada tipo (verdadero o falso, completar y opción múltiple): {por_tipo}")
        if set(por_tipo_mati) != tipos or min(por_tipo_mati.values()) < 10:
            errores.append(f"«Mi parte» necesita al menos 10 preguntas de cada tipo con frases de Mati: {por_tipo_mati}")
        html_juego = (AQUI / "index.html").read_text(encoding="utf-8") if (AQUI / "index.html").exists() else ""
        if html_juego:
            m = re.search(r'id="quiz-cifrado">(.*?)</script>', html_juego, re.S)
            if not m or '"datos"' not in m.group(1):
                errores.append("index.html no trae el juego cifrado (build.py --codigo NNN)")
            # Las frases del guion de Mati son públicas; lo que no puede quedar a la vista es la estructura del juego
            for marca in ('"respuestas"', '"correcta"', '"explicacion"', '"opciones"'):
                if marca in html_juego:
                    errores.append(f"index.html tiene {marca} en texto plano: el juego no está cifrado")
        print(f"Juego: {len(qs)} preguntas en total {por_tipo}; de Mati {por_tipo_mati}; todas con frase real del guion")
    else:
        avisos.append("No está privado/quiz_mati.json (no se pudo comprobar el juego)")

    print(f"{len(salas)} salas, {total} estaciones, {len(corpus):,} caracteres de TP leídos".replace(",", "."))
    for av in avisos:
        print("AVISO ", av)
    for er in errores:
        print("ERROR ", er)
    print("OK" if not errores else f"{len(errores)} errores")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
