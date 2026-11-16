"""Cifra un JSON con un código numérico para publicarlo en un sitio estático (pitch-web-kit).

Uso:
    python cifrar_json.py contenido.json --codigo NNN --salida cifrado.json [--iteraciones 250000]

Lo descifra CodigoCasillas.descifrar(cifrado, codigo) en assets/codigo-casillas/. Cifra en Chromium (Playwright) con
la misma WebCrypto que después descifra: AES-GCM de 256 bits con una clave PBKDF2-SHA256 del código.

Sal e IV salen del contenido (SHA-256): el mismo contenido da el mismo archivo (git no ve cambios falsos) y dos
contenidos distintos nunca comparten IV. No es seguridad fuerte: con 3 o 4 dígitos se pueden probar todas las
combinaciones. Sirve para que el texto no quede a la vista en el HTML ni en los buscadores.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

CIFRAR = """async ({texto, codigo, iteraciones, sal, iv}) => {
  const enc = new TextEncoder();
  const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const aB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
  const base = await crypto.subtle.importKey('raw', enc.encode(codigo), 'PBKDF2', false, ['deriveKey']);
  const clave = await crypto.subtle.deriveKey({name: 'PBKDF2', salt: deB64(sal), iterations: iteraciones, hash: 'SHA-256'},
    base, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
  return aB64(new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv: deB64(iv)}, clave, enc.encode(texto))));
}"""


def sal_e_iv(texto: str) -> tuple[bytes, bytes]:
    huella = hashlib.sha256(texto.encode("utf-8")).digest()
    return hashlib.sha256(b"sal|" + huella).digest()[:16], hashlib.sha256(b"iv|" + huella).digest()[:12]


def cifrar(texto: str, codigo: str, iteraciones: int = 250_000) -> dict:
    from playwright.sync_api import sync_playwright

    sal, iv = sal_e_iv(texto)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        pagina = navegador.new_page()
        # WebCrypto pide un contexto seguro: localhost lo es, sin levantar ningún servidor
        pagina.route("http://localhost/", lambda r: r.fulfill(body="<!doctype html><title>cifrar</title>", content_type="text/html"))
        pagina.goto("http://localhost/")
        datos = pagina.evaluate(CIFRAR, {"texto": texto, "codigo": codigo, "iteraciones": iteraciones, "sal": b64(sal), "iv": b64(iv)})
        navegador.close()
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iteraciones": iteraciones, "cifrado": "AES-GCM-256",
            "sal": b64(sal), "iv": b64(iv), "datos": datos}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("entrada", type=Path)
    ap.add_argument("--codigo", required=True, help="solo dígitos; no lo guardes en el repo")
    ap.add_argument("--salida", type=Path, required=True)
    ap.add_argument("--iteraciones", type=int, default=250_000)
    a = ap.parse_args()
    if not a.codigo.isdigit():
        raise SystemExit("El código tiene que ser numérico (una casilla por dígito)")
    texto = json.dumps(json.loads(a.entrada.read_text(encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))
    # Para insertarlo en <script type="application/json">, escapá "</" (un "</script>" en el texto cortaría el bloque)
    a.salida.write_text(json.dumps(cifrar(texto, a.codigo, a.iteraciones)), encoding="utf-8")
    print(f"Cifrado en {a.salida} ({len(texto)} caracteres de contenido)")


if __name__ == "__main__":
    main()
