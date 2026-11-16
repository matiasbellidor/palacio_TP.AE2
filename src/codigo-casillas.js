/* Código de N casillas (pitch-web-kit). Una casilla por dígito: avanza sola, Backspace vuelve, flechas, pegar,
   error junto a las casillas y envío automático al completar.

   HTML mínimo (ver ejemplo.html):
     <form data-codigo novalidate>
       <label id="cod-et" for="cod-1">Código</label> <span id="cod-fmt">3 números</span>
       <div role="group" aria-labelledby="cod-et cod-fmt">
         <input data-casilla id="cod-1" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="Número 1 de 3" aria-describedby="cod-ayuda cod-error">
         … una por dígito …
       </div>
       <p id="cod-ayuda" data-ayuda>…</p><p id="cod-error" data-error role="alert"></p>
       <button type="submit" data-abrir>Abrir</button>
     </form>

   Uso:
     CodigoCasillas.montar(form, {
       verificar: async (codigo) => { … devolver lo descifrado o lanzar un error si el código no sirve … },
       alAbrir: (resultado, codigo) => { … mostrar el contenido … },
       error: "Ese código no abre el contenido. Revisalo con el grupo.",
     });
   CodigoCasillas.descifrar(cifrado, codigo) descifra lo que generó scripts/cifrar_json.py. */
(() => {
  "use strict";

  async function descifrar(c, codigo) {
    if (!window.crypto || !crypto.subtle) throw new Error("sin-webcrypto");
    const deB64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(codigo), "PBKDF2", false, ["deriveKey"]);
    const clave = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: deB64(c.sal), iterations: c.iteraciones, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(c.iv) }, clave, deB64(c.datos));
    return JSON.parse(new TextDecoder().decode(plano));
  }

  function montar(form, opciones) {
    const casillas = Array.from(form.querySelectorAll("[data-casilla]"));
    const ayuda = form.querySelector("[data-ayuda]");
    const error = form.querySelector("[data-error]");
    const abrir = form.querySelector("[data-abrir]");
    const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const textoAyuda = ayuda ? ayuda.textContent : "";
    const largo = casillas.length;
    let ocupado = false;

    const codigo = () => casillas.map((c) => c.value).join("");
    function limpiar() {
      if (error) error.textContent = "";
      form.classList.remove("codigo--error");
      casillas.forEach((c) => c.removeAttribute("aria-invalid"));
    }
    function fallar(texto) {
      if (error) error.textContent = texto;
      form.classList.add("codigo--error");
      form.classList.remove("codigo--sacude");
      void form.offsetWidth;
      form.classList.add("codigo--sacude");
      casillas.forEach((c) => c.setAttribute("aria-invalid", "true"));
    }
    form.addEventListener("animationend", () => form.classList.remove("codigo--sacude"));

    function repartir(desde, digitos) {
      for (let i = 0; i < digitos.length && desde + i < largo; i++) casillas[desde + i].value = digitos[i];
      casillas[Math.min(desde + digitos.length, largo - 1)].focus();
      if (codigo().length === largo) intentar();
    }

    async function intentar() {
      const cod = codigo();
      if (ocupado || !new RegExp(`^\\d{${largo}}$`).test(cod)) return;
      ocupado = true;
      casillas.forEach((c) => { c.disabled = true; });
      if (abrir) abrir.disabled = true;
      const espera = setTimeout(() => { if (ayuda) ayuda.textContent = "Verificando…"; }, 600);
      try {
        const resultado = await opciones.verificar(cod);
        clearTimeout(espera);
        form.classList.add("codigo--ok");
        if (ayuda) ayuda.textContent = "Código correcto.";
        setTimeout(() => opciones.alAbrir(resultado, cod), reducido ? 0 : 280);
      } catch (err) {
        clearTimeout(espera);
        if (ayuda) ayuda.textContent = textoAyuda;
        casillas.forEach((c) => { c.disabled = false; c.value = ""; });
        if (abrir) abrir.disabled = false;
        fallar(err && err.message === "sin-webcrypto"
          ? "Esta página se abre desde https o localhost, no como archivo."
          : (opciones.error || "Ese código no es correcto."));
        casillas[0].focus();
      } finally {
        ocupado = false;
      }
    }

    casillas.forEach((c, i) => {
      c.addEventListener("focus", () => c.select());
      c.addEventListener("input", () => {
        const d = c.value.replace(/\D/g, "");
        limpiar();
        if (!d) { c.value = ""; return; }
        c.value = d[0];
        if (d.length > 1) { repartir(i, d); return; } // autocompletado o teclados que mandan varios dígitos juntos
        if (i < largo - 1) casillas[i + 1].focus();
        else if (codigo().length === largo) intentar();
      });
      c.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !c.value && i > 0) { e.preventDefault(); casillas[i - 1].value = ""; casillas[i - 1].focus(); }
        else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); casillas[i - 1].focus(); }
        else if (e.key === "ArrowRight" && i < largo - 1) { e.preventDefault(); casillas[i + 1].focus(); }
        else if (e.key.length === 1 && /\D/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
      });
      c.addEventListener("paste", (e) => {
        const d = ((e.clipboardData || window.clipboardData).getData("text") || "").replace(/\D/g, "").slice(0, largo);
        e.preventDefault();
        if (!d) return;
        limpiar();
        casillas.forEach((x) => { x.value = ""; });
        repartir(0, d);
      });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (codigo().length < largo) {
        fallar(`Faltan números: el código tiene ${largo}.`);
        (casillas.find((c) => !c.value) || casillas[0]).focus();
        return;
      }
      intentar();
    });
    return { intentar, limpiar };
  }

  window.CodigoCasillas = { montar, descifrar };
})();
