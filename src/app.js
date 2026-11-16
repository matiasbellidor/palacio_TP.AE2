/* Palacio mental del TP AE2: mapa, salas con estaciones, ensayo y el guion exacto de cada persona.
   Todo corre en el navegador; el progreso se guarda solo en este dispositivo (localStorage, con respaldo en memoria). */
(() => {
  "use strict";
  document.documentElement.classList.add("js");

  const D = JSON.parse(document.getElementById("datos").textContent);
  const SALAS = D.salas, META = D.meta;
  const GUION = D.guion || { lineas: {}, guiones: {} };  // guion exacto de cada persona, repartido por sala
  /* Una sala puede tener sub-salas (por ejemplo, la 5A: STL); sus estaciones cuentan en el progreso */
  const todasEst = (s) => s.estaciones.concat((s.subsalas || []).flatMap((x) => x.estaciones));
  const TOTAL = SALAS.reduce((a, s) => a + todasEst(s).length, 0);
  const CLAVE = "palacio-ae2-progreso";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const guionHTML = (s) => md(s)
    .replace(/\[pausa ([\d,]+)\s?s\]/g, '<span class="pausa">pausa $1 s</span>')
    .replace(/\[señalá «([^»]+)»\]/g, '<span class="cue cue--senal">señalá: $1</span>')
    .replace(/\[público\]/g, '<span class="cue cue--publico">al público</span>')
    .replace(/\[lento\]/g, '<span class="cue cue--lento">más lento</span>');
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const main = $("#contenido");

  /* ── Progreso ── */
  let memoria = {};
  try { memoria = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { memoria = {}; }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(memoria)); } catch (e) { /* sin almacenamiento: queda en memoria */ } };
  const hechas = (s) => todasEst(s).filter((e) => memoria[e.id]).length;
  const hechasTotal = () => SALAS.reduce((a, s) => a + hechas(s), 0);
  /* Qué diapositiva del deck corresponde a cada sala (los números salen del orden real del deck) */
  const diapoLarga = (s) => { const d = s.diapositivas || []; return !d.length ? "Sin diapositiva propia" : d.length === 1 ? `Diapositiva ${d[0]}` : `Diapositivas ${d[0]} a ${d[d.length - 1]}`; };
  const diapoCorta = (s) => { const d = s.diapositivas || []; return !d.length ? "Sin diapositiva" : d.length === 1 ? `Diap. ${d[0]}` : `Diap. ${d[0]} a ${d[d.length - 1]}`; };
  function pintarAvance() {
    $("[data-avance]").textContent = `${hechasTotal()} de ${TOTAL} estaciones que sabés`;
  }

  /* ── Estado de la vista ── */
  const reveladas = new Set();    // estaciones destapadas en el ensayo
  let modoActual = "recorrido";

  /* ── Rutas: #/  ·  #/sala/N[/ensayo|/historia]  ·  #/historia ── */
  function leerRuta() {
    const p = location.hash.replace(/^#\/?/, "").split("/");
    if (p[0] === "sala") {
      const n = Number(p[1]);
      if (n >= 1 && n <= SALAS.length) return { vista: "sala", n, modo: ["ensayo", "historia"].includes(p[2]) ? p[2] : "recorrido" };
    }
    if (p[0] === "historia") return { vista: "historia" };
    return { vista: "inicio" };
  }

  /* ── Inicio ── */
  const columnas = () => (matchMedia("(min-width: 1000px)").matches ? 5 : matchMedia("(min-width: 640px)").matches ? 3 : 2);

  function salaTile(s) {
    const h = hechas(s), t = todasEst(s).length;
    return `<a class="sala${s.tuParte ? " sala--violeta" : ""}" href="#/sala/${s.n}" data-sala="${s.n}" aria-label="Sala ${s.n}: ${esc(s.nombre)}. ${esc(s.tema)}. ${diapoLarga(s)}. ${h} de ${t} estaciones sabidas${s.tuParte ? ". La decís vos" : ""}">` +
      `<span class="sala__cab"><span class="sala__num">${s.n}</span><span class="sala__diapo">${diapoCorta(s)}</span></span><span class="sala__nombre">${esc(s.nombre)}</span><span class="sala__tema">${esc(s.tema)}</span>` +
      (s.subsalas ? `<span class="sala__sub">+ Sub-sala ${esc(s.subsalas[0].etiqueta)}: STL</span>` : "") +
      `<span class="sala__quien">${s.tuParte ? "La decís vos" : esc(s.quien)}</span>` +
      `<span class="sala__barra" aria-hidden="true"><i style="--p:${Math.round((h / t) * 100)}"></i></span></a>`;
  }

  function mapaHTML() {
    const cols = columnas();
    const filas = [];
    for (let i = 0; i < SALAS.length; i += cols) filas.push(SALAS.slice(i, i + cols));
    return `<div class="mapa${cols === 5 ? "" : " mapa--lineal"}" data-mapa style="--cols:${cols}"><svg class="mapa__ruta" aria-hidden="true" focusable="false"><path d=""/></svg>` +
      filas.map((f, i) => `<div class="mapa__fila${i % 2 && cols === 5 ? " mapa__fila--inversa" : ""}">${f.map(salaTile).join("")}</div>`).join("") + `</div>`;
  }

  function trazarRuta() {
    const mapa = $("[data-mapa]");
    if (!mapa || columnas() !== 5) return;  // el camino punteado solo se dibuja con el serpenteo de escritorio
    const r = mapa.getBoundingClientRect();
    const pts = SALAS.map((s) => {
      const el = $(`[data-sala="${s.n}"]`, mapa);
      const b = el.getBoundingClientRect();
      return [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2];
    });
    $("path", mapa).setAttribute("d", pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" "));
  }

  function inicioHTML() {
    const t = META.tuParte;
    const bajada = META.bajada.replace("{salas}", SALAS.length).replace("{estaciones}", TOTAL);
    const primera = SALAS.find((s) => hechas(s) < s.estaciones.length) || SALAS[0];
    return `<div class="portada"><section class="hero"><p class="kicker">Trabajo práctico · Análisis Estadístico 2 · Grupo 1</p>` +
      `<h1>${esc(META.titulo)}</h1><p>${esc(bajada)}</p>` +
      `<div class="hero__acciones"><a class="boton boton--primario" href="#/sala/${primera.n}">${hechasTotal() ? "Seguir el recorrido" : "Empezar el recorrido"}</a>` +
      `<a class="boton" href="#/historia">Leer la historia completa</a></div>` +
      `<p class="leyenda" aria-label="Colores"><span><i class="i-v"></i>Violeta: lo que decís vos</span><span><i class="i-a"></i>Celeste: el resto del trabajo</span></p></section>` +
      `<section class="tuparte" aria-labelledby="tp-t"><p class="kicker" style="color:var(--violeta)">Tu parte</p>` +
      `<h2 id="tp-t">Lo que decís vos: <span class="tuparte__reloj">${esc(t.desde)} a ${esc(t.hasta)}</span> · ${t.segundos} s</h2>` +
      `<p>${esc(t.texto)}</p><div class="tuparte__acciones">${t.salas.map((n) => { const s = SALAS[n - 1]; return `<a class="boton boton--violeta" href="#/sala/${n}">Sala ${n}: ${esc(s.nombre)}</a>`; }).join("")}</div></section></div>` +
      `<section class="seccion" aria-labelledby="mapa-t"><h2 id="mapa-t">El mapa del gimnasio</h2><p class="bajada">Recorrelo siempre en este orden, de la sala 1 a la ${SALAS.length}${columnas() === 5 ? ". La línea punteada es el camino" : ""}.</p>${mapaHTML()}</section>` +
      `<section class="seccion" aria-labelledby="el-t"><h2 id="el-t">Los personajes que se repiten</h2><p class="bajada">Aparecen en casi todas las salas. Si los conocés bien, cada estación se arma sola.</p>` +
      `<div class="elenco">${META.elenco.map((p) => `<div class="personaje"><h3>${esc(p.nombre)}</h3><p class="rol">${esc(p.rol)}</p><p>${esc(p.imagen)}</p></div>`).join("")}</div></section>` +
      `<section class="seccion" aria-labelledby="faq-t"><h2 id="faq-t">Cómo se usa</h2><div class="faq">${META.como.map((c, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(c.q)}</summary><p>${esc(c.a)}</p></details>`).join("")}</div></section>`;
  }

  /* ── Sala ── */
  const ICONO_GUION = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/></svg>';

  function dichoHTML(it) {
    const mati = it.orador === "mati";
    return `<section class="dicho${mati ? " dicho--mati" : ""}"><div class="dicho__cab"><span class="chip ${mati ? "chip--violeta" : "chip--azul"}">${esc(it.etiqueta)}${mati ? " · vos" : ""}</span>` +
      `<span class="dicho__tema">${esc(it.tema)}</span><span class="dicho__tiempo">${esc(it.tiempo)}</span></div>` +
      (it.como ? `<p class="dicho__como"><b>Cómo:</b> ${esc(it.como)}</p>` : "") +
      `<div class="dicho__texto">${it.lineas.map((l) => `<p>${guionHTML(l)}</p>`).join("")}</div>` +
      (it.pase ? `<p class="dicho__pase"><b>Pase a ${esc(it.pase.a)}:</b> «${esc(it.pase.frase)}»</p>` : "") + `</section>`;
  }

  /* El guion exacto de lo que dice cada persona en esta sala, para comparar con la historia del palacio */
  function guionDeSala(s) {
    if (s.conGuion === false) return `<p class="dicho__vacio">${esc(s.sinGuion || "Esta sala no tiene guion propio.")}</p>`;
    const items = (GUION.guiones || {})[s.n] || [];
    return items.length ? items.map(dichoHTML).join("") : `<p class="dicho__vacio">Esta sala no tiene guion propio.</p>`;
  }

  /* Panel al lado de cada sala (plegable en celular) */
  function ladoHTML(s) {
    return `<details class="lado" data-lado open><summary><span class="lado__t">${ICONO_GUION}Lo que dicen en la exposición</span></summary>` +
      `<div class="lado__cuerpo">${guionDeSala(s)}</div></details>`;
  }

  function estHTML(s, e, i, modo) {
    const dice = !!e.dice;
    const sabe = !!memoria[e.id];
    const priv = dice && GUION.lineas && GUION.lineas[e.id]
      ? `<blockquote class="guion"><small>Lo que decís, textual</small>${GUION.lineas[e.id].map((l) => `<p>${guionHTML(l)}</p>`).join("")}</blockquote>` : "";
    const cuerpo = `<p class="est__imagen">${md(e.imagen)}</p>${e.significa ? `<p class="est__sig">(<b>De qué se trata:</b> ${md(e.significa)})</p>` : ""}<p class="est__frase">${esc(e.frase)}</p>` +
      `<div class="est__dato"><b>${dice ? "Qué cubrís vos" : "Qué hay que saber"}</b>${md(e.dato)}</div>${priv}`;
    const acciones = `<div class="est__acciones"><button class="est__sabe" type="button" data-sabe="${e.id}" aria-pressed="${sabe}">Lo sé</button></div>`;
    const cab = `<div class="est__cab"><span class="est__num" aria-hidden="true">${i + 1}</span><h3 class="est__lugar"><span class="sr-only">Estación ${i + 1}: </span>${esc(e.lugar)}</h3>${dice ? '<span class="chip chip--violeta">Lo decís vos</span>' : ""}</div>`;
    if (modo === "ensayo" && !reveladas.has(e.id)) {
      return `<li class="est est--ensayo${dice ? " est--dice" : ""}" data-est="${e.id}">${cab}<div class="est__tapa"><p>Cerrá los ojos y pararte en <strong>${esc(e.lugar)}</strong>. ¿Qué imagen dejaste y qué dato guarda?</p>` +
        `<button class="boton${dice ? " boton--violeta" : ""}" type="button" data-mostrar="${e.id}">Mostrame</button></div></li>`;
    }
    return `<li class="est${modo === "ensayo" ? " est--ensayo" : ""}${dice ? " est--dice" : ""}" data-est="${e.id}">${cab}<div class="est__cuerpo">${cuerpo}</div>${acciones}</li>`;
  }

  function subsalasHTML(s, modo) {
    return (s.subsalas || []).map((x) =>
      `<section class="subsala" id="sub-${esc(x.id)}" aria-labelledby="sub-${esc(x.id)}-t"><div class="subsala__cab">` +
      `<p class="kicker">Sub-sala ${esc(x.etiqueta)} · ${esc(x.lugar)}</p><h2 id="sub-${esc(x.id)}-t">${esc(x.nombre)}</h2>` +
      `<p class="sala-cab__tema">${esc(x.tema)}</p><div class="sala-cab__chips"><span class="chip chip--azul">Si te preguntan</span><span class="chip chip--diapo">Dentro de la sala ${s.n} · ${esc(diapoLarga(s))}</span><span class="chip">${x.estaciones.length} estaciones</span></div>` +
      `${x.nota ? `<p class="sala-cab__como">${esc(x.nota)}</p>` : ""}</div>` +
      `<ol class="estaciones">${x.estaciones.map((e, i) => estHTML(s, e, i, modo)).join("")}</ol></section>`).join("");
  }

  function cuerpoSala(s, modo) {
    if (modo === "historia") {
      return `<div class="historia"><p>${md(s.historia)}</p>${(s.subsalas || []).map((x) => `<p><strong>Sub-sala ${esc(x.etiqueta)} (${esc(x.nombre)}):</strong> ${md(x.historia)}</p><p class="puente">${md(x.puerta)}</p>`).join("")}<p class="puente">${md(s.puerta)}</p></div>`;
    }
    const barra = modo === "ensayo"
      ? `<div class="est__acciones" style="margin-bottom:var(--e4)"><button class="boton" type="button" data-todo="tapar">Tapar todo</button><button class="boton" type="button" data-todo="mostrar">Mostrar todo</button></div>` : "";
    const sig = s.n < SALAS.length
      ? `<a class="boton boton--primario" href="#/sala/${s.n + 1}">Sala ${s.n + 1}: ${esc(SALAS[s.n].nombre)}</a>`
      : `<a class="boton boton--primario" href="#/">Volver al mapa</a>`;
    return `${barra}<ol class="estaciones">${s.estaciones.map((e, i) => estHTML(s, e, i, modo)).join("")}</ol>` + subsalasHTML(s, modo) +
      `<div class="puerta"><h2>${s.n < SALAS.length ? "La puerta a la siguiente sala" : "Fin del recorrido"}</h2><p>${md(s.puerta)}</p>${sig}</div>`;
  }

  function salaHTML(s, modo) {
    const ant = s.n > 1 ? `<a class="boton" href="#/sala/${s.n - 1}" aria-label="Sala anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg><span class="txt">Anterior</span></a>` : "";
    const sgt = s.n < SALAS.length ? `<a class="boton" href="#/sala/${s.n + 1}" aria-label="Sala siguiente"><span class="txt">Siguiente</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>` : "";
    const tab = (id, txt) => `<button type="button" role="tab" id="tab-${id}" aria-selected="${modo === id}" aria-controls="cuerpo" data-modo="${id}" tabindex="${modo === id ? 0 : -1}">${txt}</button>`;
    return `<div class="sala-cab"><nav class="sala-nav" aria-label="Salas"><a class="boton" href="#/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Mapa</a>` +
      `<span class="sala-nav__pos">Sala ${s.n} de ${SALAS.length}</span><span class="sala-nav__espacio"></span>${ant}${sgt}</nav>` +
      `<p class="kicker"${s.tuParte ? ' style="color:var(--violeta)"' : ""}>Sala ${s.n} · ${esc(diapoLarga(s))} · ${esc(s.diapositiva)}</p>` +
      `<h1 tabindex="-1" data-foco>${esc(s.nombre)}</h1><p class="sala-cab__tema">${esc(s.tema)}</p>` +
      (s.idea ? `<p class="sala-cab__idea${s.tuParte ? " sala-cab__idea--violeta" : ""}">(<b>Qué es este cuarto:</b> ${esc(s.idea)})</p>` : "") +
      `<div class="sala-cab__chips">${s.tuParte ? `<span class="chip chip--violeta">La decís vos · ${esc(s.tiempo)}</span>` : `<span class="chip chip--azul">Lo dice ${esc(s.quien)}</span>`}<span class="chip chip--diapo">${esc(diapoLarga(s))}</span><span class="chip">${todasEst(s).length} estaciones</span>${(s.subsalas || []).map((x) => `<button class="chip chip--btn" type="button" data-ir="sub-${esc(x.id)}">Sub-sala ${esc(x.etiqueta)}: ${esc(x.nombre)} ↓</button>`).join("")}</div>` +
      `<p class="sala-cab__como">${esc(s.como || s.resumen)}</p>${s.diapositivaNota ? `<p class="sala-cab__como">${esc(s.diapositivaNota)}</p>` : ""}</div>` +
      `<div class="sala-cols"><div class="sala-cols__main">` +
      `<div class="pestanas${s.tuParte ? " pestanas--violeta" : ""}" role="tablist" aria-label="Cómo estudiar esta sala">${tab("recorrido", "Recorrido")}${tab("ensayo", "Ensayo")}${tab("historia", "Historia")}</div>` +
      `<div id="cuerpo" role="tabpanel" aria-labelledby="tab-${modo}" data-cuerpo>${cuerpoSala(s, modo)}</div></div>${ladoHTML(s)}</div>`;
  }

  function renderSala(r, conFoco) {
    const s = SALAS[r.n - 1];
    modoActual = r.modo;
    main.innerHTML = `<div class="view">${salaHTML(s, r.modo)}</div>`;
    document.title = `Sala ${s.n}: ${s.nombre} · Palacio AE2`;
    if (matchMedia("(max-width: 1099px)").matches) { const l = $("[data-lado]"); if (l) l.open = false; }
    if (conFoco) $("[data-foco]").focus({ preventScroll: true });
  }

  function cambiarModo(modo) {
    const r = leerRuta();
    const s = SALAS[r.n - 1];
    modoActual = modo;
    history.replaceState(null, "", `#/sala/${s.n}${modo === "recorrido" ? "" : "/" + modo}`);
    $("[data-cuerpo]").innerHTML = cuerpoSala(s, modo);
    $("[data-cuerpo]").setAttribute("aria-labelledby", `tab-${modo}`);
    $$("[data-modo]").forEach((b) => { const a = b.dataset.modo === modo; b.setAttribute("aria-selected", String(a)); b.tabIndex = a ? 0 : -1; });
  }

  /* ── Historia completa ── */
  function historiaHTML() {
    return `<section class="hero" style="padding-bottom:var(--e4)"><p class="kicker">Historia completa</p><h1>La película de todo el trabajo</h1>` +
      `<p>Leela de corrido y en voz alta, una vez por día. Es el hilo que une las ${SALAS.length} salas. Al lado de cada sala está el guion exacto de lo que dice cada persona: comparalo con la historia para ver qué parte de lo que hay que decir pasa en cada escena.</p></section>` +
      `<div class="historia historia--completa">${SALAS.map((s) =>
        `<section class="historia-sala${s.tuParte ? " historia-sala--violeta" : ""}" aria-labelledby="hs-${s.n}"><div class="historia-sala__texto">` +
        `<h2 id="hs-${s.n}"><span>Sala ${s.n} · ${esc(diapoCorta(s))}</span><a href="#/sala/${s.n}" style="color:inherit;text-decoration:none">${esc(s.nombre)}</a></h2>` +
        `<p>${md(s.historia)}</p>${(s.subsalas || []).map((x) => `<p><strong>Sub-sala ${esc(x.etiqueta)} (${esc(x.nombre)}):</strong> ${md(x.historia)}</p>`).join("")}` +
        `<p class="puente">${md(s.puerta)}</p></div>` +
        `<div class="historia-sala__guion"><p class="kicker">Guion exacto de esta sala</p>${guionDeSala(s)}</div></section>`).join("")}</div>`;
  }

  /* ── Render general ── */
  let primera = true;
  function render() {
    const r = leerRuta();
    $$("[data-nav]").forEach((a) => {
      const activo = (a.dataset.nav === "historia") === (r.vista === "historia");
      if (activo) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (r.vista === "sala") renderSala(r, !primera);
    else if (r.vista === "historia") {
      main.innerHTML = `<div class="view">${historiaHTML()}</div>`;
      document.title = "Historia completa · Palacio AE2";
    } else {
      main.innerHTML = `<div class="view">${inicioHTML()}</div>`;
      document.title = "Palacio mental · TP AE2";
      trazarRuta();
    }
    pintarAvance();
    if (!primera) {
      window.scrollTo({ top: 0, behavior: "instant" });
      if (r.vista !== "sala") main.focus({ preventScroll: true });
      $("[data-anuncio]").textContent = document.title;
    }
    primera = false;
  }

  /* ── Eventos ── */
  main.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.sabe) {
      const id = b.dataset.sabe;
      if (memoria[id]) delete memoria[id]; else memoria[id] = 1;
      guardar();
      b.setAttribute("aria-pressed", String(!!memoria[id]));
      pintarAvance();
    } else if (b.dataset.mostrar) {
      reveladas.add(b.dataset.mostrar);
      const r = leerRuta();
      const y = window.scrollY;
      $("[data-cuerpo]").innerHTML = cuerpoSala(SALAS[r.n - 1], "ensayo");
      window.scrollTo({ top: y, behavior: "instant" });
      const nuevo = $(`[data-sabe="${b.dataset.mostrar}"]`);
      if (nuevo) nuevo.focus({ preventScroll: true });
    } else if (b.dataset.todo) {
      const r = leerRuta();
      const s = SALAS[r.n - 1];
      todasEst(s).forEach((e2) => (b.dataset.todo === "mostrar" ? reveladas.add(e2.id) : reveladas.delete(e2.id)));
      $("[data-cuerpo]").innerHTML = cuerpoSala(s, "ensayo");
    } else if (b.dataset.ir) {
      if (modoActual === "historia") cambiarModo("recorrido");
      const destino = document.getElementById(b.dataset.ir);
      if (destino) destino.scrollIntoView({ behavior: reducido ? "instant" : "smooth", block: "start" });
    } else if (b.dataset.modo) {
      cambiarModo(b.dataset.modo);
    }
  });
  main.addEventListener("keydown", (e) => {
    const t = e.target.closest('[role="tab"]');
    if (!t || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const tabs = $$('[role="tab"]');
    const nuevo = tabs[(tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    nuevo.focus();
    cambiarModo(nuevo.dataset.modo);
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest("input, textarea, select, [role='tab']")) return;
    const r = leerRuta();
    if (r.vista !== "sala") return;
    if (e.key === "ArrowRight" && r.n < SALAS.length) location.hash = `#/sala/${r.n + 1}`;
    else if (e.key === "ArrowLeft" && r.n > 1) location.hash = `#/sala/${r.n - 1}`;
  });
  $("[data-borrar]").addEventListener("click", () => {
    if (!confirm("¿Borrar el progreso guardado en este dispositivo? Las estaciones que marcaste como sabidas se van a desmarcar.")) return;
    memoria = {};
    reveladas.clear();
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada que borrar */ }
    render();
  });
  window.addEventListener("hashchange", render);
  let temporizador = 0;
  let colsAntes = columnas();
  window.addEventListener("resize", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (leerRuta().vista !== "inicio") return;
      if (columnas() !== colsAntes) { colsAntes = columnas(); render(); } else trazarRuta();
    }, 120);
  });
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (leerRuta().vista === "inicio") trazarRuta(); });
})();
