/* Juego para practicar el guion: verdadero o falso, completar escribiendo y opción múltiple.
   Dos secciones: «Mi parte» (lo que dice Mati) y «Todo el trabajo» (el guion entero de los cinco, como si tuviera que
   presentar todo). Cada pregunta se apoya en una frase exacta del guion. Las preguntas viajan cifradas: se abren con
   un código y no se recuerda. */
(() => {
  "use strict";

  const CLAVE = "palacio-ae2-juego";
  let cifrado = null;
  try {
    const c = JSON.parse(document.getElementById("quiz-cifrado").textContent);
    cifrado = c && c.datos ? c : null;
  } catch (e) { cifrado = null; }
  let DATOS = {};
  try { DATOS = JSON.parse(document.getElementById("datos").textContent) || {}; } catch (e) { DATOS = {}; }
  const SALAS = DATOS.salas || [];
  let preguntas = null; // solo en memoria: al recargar vuelve a pedir el código
  let mejor = {};
  try { mejor = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { mejor = {}; }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(mejor)); } catch (e) { /* sin almacenamiento */ } };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  /* Sin mayúsculas, sin tildes, sin espacios ni signos: «P-valor», «p valor» y «pvalor» valen lo mismo */
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
  const limpiar = (s) => String(s).replace(/\[[^\]]*\]/g, " ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const mezclar = (a) => {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  };

  const TIPOS = ["vf", "completar", "mc"];
  const MODOS = {
    todo: { nombre: "Todo mezclado", tipos: TIPOS, desc: "Los tres tipos de pregunta, en desorden." },
    vf: { nombre: "Verdadero o falso", tipos: ["vf"], desc: "Decidí si la afirmación es cierta." },
    completar: { nombre: "Completar escribiendo", tipos: ["completar"], desc: "Escribí la palabra que falta." },
    mc: { nombre: "Opción múltiple", tipos: ["mc"], desc: "Elegí la respuesta correcta entre cuatro." },
    orden: { nombre: "En orden de la exposición", tipos: TIPOS, desc: "Todo el guion en el orden en que se presenta, para aprender el hilo completo." },
  };
  const SECCIONES = {
    mi: {
      nombre: "Mi parte", titulo: "Mi parte · salas 4 y 5",
      desc: "Solo lo que decís vos: de dónde salen los datos, el problema y cómo lo resolvieron.", modos: ["todo", "vf", "completar", "mc"],
    },
    g: {
      nombre: "Todo el trabajo", titulo: "Todo el trabajo · el guion entero",
      desc: "Como si tuvieras que presentar todo vos: qué métodos usaron, para qué, por qué y qué dio cada uno. Preguntas del guion de los cinco.",
      modos: ["todo", "vf", "completar", "mc", "orden"],
    },
  };
  const LETRAS = ["A", "B", "C", "D"];
  const ICONO_CANDADO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 15v2"/></svg>';
  const claveMejor = (sec, modo) => (sec === "mi" ? modo : "g:" + modo);

  /* Dónde se dice cada pregunta: busca su frase en el guion de los cinco (en orden de exposición) */
  function ubicar(lista) {
    const items = [];
    const g = (DATOS.guion && DATOS.guion.guiones) || {};
    Object.keys(g).map(Number).sort((a, b) => a - b).forEach((sala) => g[sala].forEach((it) => {
      const lineas = it.lineas.concat(it.pase ? [it.pase.frase] : []);
      items.push({ sala, quien: it.etiqueta, orador: it.orador, texto: lineas.map(limpiar).join(" ") });
    }));
    return lista.map((q) => {
      const pieza = limpiar(q.guion.split(" … ")[0]);
      const hits = [];
      items.forEach((it, k) => { const i = it.texto.indexOf(pieza); if (i >= 0) hits.push({ it, k, i }); });
      const mati = hits.find((h) => h.it.orador === "mati");
      const h = mati || hits[0];
      return Object.assign({}, q, { esMati: !!mati, sala: h ? h.it.sala : null, quien: h ? h.it.quien : "", pos: h ? h.k * 100000 + h.i : 1e9 });
    });
  }
  const nombreSala = (n) => (SALAS[n - 1] ? SALAS[n - 1].nombre : "");

  function montar(raiz) {
    raiz.innerHTML = '<div class="view juego" data-juego></div>';
    const cont = raiz.firstElementChild;
    const E = { pantalla: preguntas ? "inicio" : "puerta", sec: "mi", modo: "todo", cola: [], i: 0, aciertos: 0, falladas: [], hecha: null, orden: [], repetir: false };

    const delModo = (sec, modo) => {
      const base = (sec === "mi" ? preguntas.filter((q) => q.esMati) : preguntas).filter((q) => MODOS[modo].tipos.includes(q.tipo));
      return modo === "orden" ? base.slice().sort((a, b) => a.pos - b.pos) : base;
    };
    const actual = () => E.cola[E.i];
    const textoCorrecta = (q) => (q.tipo === "vf" ? (q.correcta ? "Verdadero" : "Falso") : q.tipo === "mc" ? q.opciones[q.correcta] : q.respuestas[0]);
    const repasar = (q) => (q.sala ? `<a class="juego__repasar" href="#/sala/${q.sala}" target="_blank" rel="noopener">Repasalo en el palacio: sala ${q.sala}, ${esc(nombreSala(q.sala))} (se abre en otra pestaña)</a>` : "");

    function puertaHTML() {
      if (!cifrado || !window.CodigoCasillas) {
        return `<section class="juego__card"><h1 class="juego__titulo" tabindex="-1" data-foco>Practicá</h1><p>El juego no está disponible en esta versión de la página.</p></section>`;
      }
      const casillas = [1, 2, 3].map((i) => `<input class="codigo__casilla" id="cod-${i}" data-casilla type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Número ${i} de 3" aria-describedby="cod-ayuda cod-error">`).join("");
      return `<section class="juego__card juego__puerta"><div class="juego__puerta-cab">${ICONO_CANDADO}<h1 class="juego__titulo" tabindex="-1" data-foco>Practicá</h1></div>` +
        `<p>Un juego con preguntas sobre el guion: primero tu parte de Mati y después todo el trabajo, como si tuvieras que presentarlo entero. Verdadero o falso, completar escribiendo y opción múltiple. Se abre con un código.</p>` +
        `<form class="codigo" data-codigo novalidate><div class="codigo__cabecera"><label class="codigo__etiqueta" id="cod-et" for="cod-1">Código</label><span class="codigo__formato" id="cod-fmt">3 números</span></div>` +
        `<div class="codigo__casillas" role="group" aria-labelledby="cod-et cod-fmt">${casillas}</div>` +
        `<p class="codigo__ayuda" id="cod-ayuda" data-ayuda>Se abre solo al completar las tres casillas. También podés pegarlo.</p>` +
        `<p class="codigo__error" id="cod-error" data-error role="alert"></p><button class="codigo__abrir" type="submit" data-abrir>Abrir el juego</button></form></section>`;
    }

    function inicioHTML() {
      const bloques = Object.entries(SECCIONES).map(([sec, S]) => {
        const tarjetas = S.modos.map((k) => {
          const m = MODOS[k];
          const n = delModo(sec, k).length;
          const mj = mejor[claveMejor(sec, k)] != null ? `<span class="juego__mejor">Tu mejor resultado: ${mejor[claveMejor(sec, k)]} %</span>` : `<span class="juego__mejor">Todavía sin jugar</span>`;
          return `<button class="juego__modo${k === "orden" ? " juego__modo--orden" : ""}" type="button" data-jmodo="${sec}:${k}"><strong>${esc(m.nombre)}</strong><span>${esc(m.desc)}</span><span class="juego__n">${n} preguntas</span>${mj}</button>`;
        }).join("");
        return `<section class="juego__seccion" aria-labelledby="sec-${sec}"><h2 class="juego__sub" id="sec-${sec}">${esc(S.titulo)}</h2><p class="juego__desc">${esc(S.desc)}</p><div class="juego__modos">${tarjetas}</div></section>`;
      }).join("");
      return `<section class="juego__intro"><p class="kicker" style="color:var(--violeta)">Practicá el guion</p><h1 class="juego__titulo" tabindex="-1" data-foco>Practicá</h1>` +
        `<p>${preguntas.length} preguntas sacadas solo del guion. Después de cada respuesta ves la frase exacta que se dice. Elegí qué practicar: solo tu parte, o todo el trabajo como si lo presentaras vos.</p></section>${bloques}`;
    }

    function cabHTML() {
      const n = E.cola.length;
      const pct = Math.round((E.i / n) * 100);
      return `<div class="juego__cab"><span class="chip chip--violeta">${esc(E.repetir ? "Las que fallaste" : SECCIONES[E.sec].nombre + " · " + MODOS[E.modo].nombre)}</span>` +
        `<span class="juego__cont">Pregunta ${E.i + 1} de ${n} · ${E.aciertos} ${E.aciertos === 1 ? "acierto" : "aciertos"}</span></div>` +
        `<div class="juego__barra" role="progressbar" aria-label="Avance del juego" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>`;
    }

    function preguntaHTML() {
      const q = actual();
      const h = E.hecha;
      const bloquear = h ? " disabled" : "";
      let cuerpo = "";
      if (q.tipo === "vf") {
        const cls = (v) => (h ? (v === q.correcta ? " juego__op--ok" : (v === h.dada ? " juego__op--mal" : "")) : "");
        cuerpo = `<div class="juego__opciones juego__opciones--2"><button class="juego__op${cls(true)}" type="button" data-resp="true"${bloquear}><b aria-hidden="true">V</b>Verdadero</button>` +
          `<button class="juego__op${cls(false)}" type="button" data-resp="false"${bloquear}><b aria-hidden="true">F</b>Falso</button></div>` +
          (h ? "" : `<p class="juego__atajo">Atajos: V para verdadero, F para falso.</p>`);
      } else if (q.tipo === "mc") {
        cuerpo = `<div class="juego__opciones">${E.orden.map((orig, d) => {
          const cls = h ? (orig === q.correcta ? " juego__op--ok" : (d === h.dada ? " juego__op--mal" : "")) : "";
          return `<button class="juego__op${cls}" type="button" data-opc="${d}"${bloquear}><b aria-hidden="true">${LETRAS[d]}</b>${esc(q.opciones[orig])}</button>`;
        }).join("")}</div>` + (h ? "" : `<p class="juego__atajo">Atajos: las teclas 1, 2, 3 y 4.</p>`);
      } else {
        const partes = q.texto.split("___");
        const valor = h ? ` value="${esc(h.dada)}" readonly` : "";
        const input = `<input class="juego__input${h ? (h.ok ? " juego__input--ok" : " juego__input--mal") : ""}" name="resp" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Palabra que falta" size="14"${valor}>`;
        cuerpo = `<form class="juego__form" data-form novalidate><p class="juego__texto">${esc(partes[0])}${input}${esc(partes.slice(1).join("___"))}</p>` +
          (h ? "" : `<details class="juego__pista"><summary>Ver pista</summary><p>${esc(q.pista || "Sin pista para esta.")}</p></details>` +
            `<button class="boton boton--violeta" type="submit">Comprobar</button>`) + `</form>`;
      }
      const kicker = { vf: "Verdadero o falso", mc: "Opción múltiple", completar: "Completar escribiendo" }[q.tipo];
      const ctx = E.sec === "g" && q.sala ? `<p class="juego__ctx">Lo dice <strong>${esc(q.quien)}</strong> · sala ${q.sala}: ${esc(nombreSala(q.sala))}</p>` : "";
      const titulo = q.tipo === "completar" ? "" : `<h2 class="juego__texto" id="jq" tabindex="-1" data-foco>${esc(q.texto)}</h2>`;
      let fb = "";
      if (h) {
        fb = `<div class="juego__fb ${h.ok ? "juego__fb--ok" : "juego__fb--mal"}" role="status">` +
          `<p class="juego__fb-t"><span aria-hidden="true">${h.ok ? "✓" : "✗"}</span> ${h.ok ? "¡Bien!" : "Todavía no"}</p>` +
          (h.ok ? "" : `<p>La respuesta era: <strong>${esc(textoCorrecta(q))}</strong></p>`) +
          `<p>${esc(q.explicacion)}</p>` +
          `<blockquote class="juego__guion"><small>${esc(q.quien ? "El guion dice (" + q.quien + ")" : "El guion dice")}</small>«${md(q.guion.split(" … ").join("… "))}»</blockquote>` +
          repasar(q) +
          `<button class="boton boton--primario" type="button" data-sig>${E.i + 1 < E.cola.length ? "Siguiente" : "Ver mi resultado"}</button></div>`;
      }
      return cabHTML() + `<section class="juego__card" aria-label="Pregunta ${E.i + 1}"><p class="kicker" style="color:var(--violeta)">${kicker}</p>${ctx}${titulo}${cuerpo}${fb}</section>`;
    }

    function finHTML() {
      const n = E.cola.length, pct = Math.round((E.aciertos / n) * 100);
      const msg = pct === 100 ? "¡Perfecto! Te la sabés."
        : pct >= 80 ? "Muy bien. Repasá lo que fallaste y estás."
        : pct >= 50 ? "Vas bien, pero repasá en el palacio lo que fallaste."
        : "Volvé al palacio, leé el guion en voz alta y probá de nuevo.";
      const fallas = E.falladas.map((q) => `<li class="juego__falla"><p><strong>${esc(q.texto.replace("___", "…"))}</strong></p><p>Respuesta: ${esc(textoCorrecta(q))}</p>` +
        `<blockquote class="juego__guion"><small>${esc(q.quien ? "El guion dice (" + q.quien + ")" : "El guion dice")}</small>«${md(q.guion.split(" … ").join("… "))}»</blockquote>${repasar(q)}</li>`).join("");
      return `<section class="juego__card juego__fin"><p class="kicker" style="color:var(--violeta)">Resultado · ${esc(E.repetir ? "las que fallaste" : SECCIONES[E.sec].nombre + " · " + MODOS[E.modo].nombre)}</p>` +
        `<h1 class="juego__titulo" tabindex="-1" data-foco>${E.aciertos} de ${n}</h1><p class="juego__nota" aria-label="${pct} por ciento">${pct} %</p><p>${msg}</p>` +
        `<div class="juego__acciones">${E.falladas.length ? `<button class="boton boton--primario" type="button" data-repetir>Repetir las que fallé (${E.falladas.length})</button>` : ""}` +
        `<button class="boton boton--violeta" type="button" data-again>Jugar de nuevo</button><button class="boton" type="button" data-inicio>Cambiar de modo</button></div></section>` +
        (E.falladas.length ? `<section class="juego__fallas"><h2 class="juego__sub">Para repasar</h2><ul>${fallas}</ul></section>` : "");
    }

    function pintar(foco) {
      if (E.pantalla === "puerta") cont.innerHTML = puertaHTML();
      else if (E.pantalla === "inicio") cont.innerHTML = inicioHTML();
      else if (E.pantalla === "jugando") cont.innerHTML = preguntaHTML();
      else cont.innerHTML = finHTML();
      if (E.pantalla === "puerta") montarPuerta();
      if (foco) {
        const f = cont.querySelector(foco);
        if (f) f.focus({ preventScroll: E.pantalla === "jugando" });
      }
    }

    function montarPuerta() {
      const form = cont.querySelector("[data-codigo]");
      if (!form || !window.CodigoCasillas) return;
      CodigoCasillas.montar(form, {
        verificar: (cod) => CodigoCasillas.descifrar(cifrado, cod),
        alAbrir: (d) => { preguntas = ubicar(d.preguntas); E.pantalla = "inicio"; pintar("[data-foco]"); },
        error: "Ese código no abre el juego.",
      });
    }

    function empezar(cola, repetir) {
      E.cola = cola; E.i = 0; E.aciertos = 0; E.falladas = []; E.hecha = null; E.repetir = !!repetir;
      E.orden = [];
      E.pantalla = "jugando";
      preparar();
      pintar("[data-foco], .juego__input");
    }
    function preparar() {
      const q = actual();
      if (q && q.tipo === "mc") E.orden = mezclar(q.opciones.map((_, k) => k));
    }
    function responder(ok, dada) {
      const q = actual();
      E.hecha = { ok, dada };
      if (ok) E.aciertos += 1; else E.falladas.push(q);
      pintar("[data-sig]");
    }
    const jugarModo = () => { const l = delModo(E.sec, E.modo); empezar(E.modo === "orden" ? l : mezclar(l), false); };

    cont.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.jmodo) {
        [E.sec, E.modo] = b.dataset.jmodo.split(":");
        jugarModo();
      } else if (b.hasAttribute("data-resp")) {
        const v = b.dataset.resp === "true";
        responder(v === actual().correcta, v);
      } else if (b.dataset.opc != null) {
        const d = Number(b.dataset.opc);
        responder(E.orden[d] === actual().correcta, d);
      } else if (b.hasAttribute("data-sig")) {
        E.hecha = null; E.i += 1;
        if (E.i >= E.cola.length) {
          E.pantalla = "fin";
          if (!E.repetir) { const pct = Math.round((E.aciertos / E.cola.length) * 100); const k = claveMejor(E.sec, E.modo); mejor[k] = Math.max(mejor[k] || 0, pct); guardar(); }
          pintar("[data-foco]");
        } else { preparar(); pintar("[data-foco], .juego__input"); }
      } else if (b.hasAttribute("data-repetir")) {
        empezar(mezclar(E.falladas), true);
      } else if (b.hasAttribute("data-again")) {
        jugarModo();
      } else if (b.hasAttribute("data-inicio")) {
        E.pantalla = "inicio"; pintar("[data-foco]");
      }
    });

    cont.addEventListener("submit", (e) => {
      const f = e.target.closest("[data-form]");
      if (!f) return;
      e.preventDefault();
      if (E.hecha) return;
      const dada = f.elements.resp.value.trim();
      if (!dada) { f.elements.resp.focus(); return; }
      const q = actual();
      responder(q.respuestas.some((r) => norm(r) === norm(dada)), dada);
    });

    cont.addEventListener("keydown", (e) => {
      if (E.pantalla !== "jugando" || E.hecha || e.altKey || e.ctrlKey || e.metaKey || e.target.closest("input, textarea")) return;
      const q = actual();
      const k = e.key.toLowerCase();
      if (q.tipo === "vf" && (k === "v" || k === "f")) { e.preventDefault(); responder((k === "v") === q.correcta, k === "v"); }
      else if (q.tipo === "mc" && ["1", "2", "3", "4"].includes(k)) { e.preventDefault(); const d = Number(k) - 1; responder(E.orden[d] === q.correcta, d); }
    });

    pintar();
  }

  function borrar() {
    mejor = {};
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada que borrar */ }
  }

  window.PalacioJuego = { montar, borrar };
})();
