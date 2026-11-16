# Palacio mental del TP de Análisis Estadístico 2

Material de estudio del Grupo 1 para exponer el trabajo práctico [«¿El bono argentino sigue al PBI?»](https://github.com/matiasbellidor/trabajo_practico_AE2): el trabajo entero, caminando un gimnasio.

**Es un [palacio de la memoria](https://es.wikipedia.org/wiki/M%C3%A9todo_de_loci)** (método de loci): un lugar que conocés de memoria, recorrido siempre en el mismo orden, con una imagen exagerada en cada punto que guarda un dato.

- **15 salas y 88 estaciones**, en el orden de la exposición. La sala 5 tiene una **sub-sala (5A: la licuadora STL)** que explica qué es STL, sus tres componentes y cómo funciona el loess. Cada estación tiene un lugar, una imagen absurda, una frase para recordarla y el dato que guarda.
- **Cada sala dice qué diapositiva del deck le corresponde** (en el mapa, en el encabezado y en la historia completa). Las salas sin diapositiva propia lo aclaran y dicen dónde están en el informe. `verificar.py` comprueba los números contra el orden real del deck del TP.
- **En violeta, lo que dice Mati** (salas 4 y 5, de 2:10 a 4:00, más el «¡Hola!» del grupo). En celeste, el resto del trabajo, por si hay que contestar preguntas o cubrir a alguien.
- **Personajes que se repiten:** AL (el bono), Don Pibi (el PBI), el Dado (p-valor), la Cinta (intervalo de confianza) y la Cero (H0).
- **Tres modos por sala:** Recorrido (todo a la vista), Ensayo (las imágenes tapadas hasta que las pedís) e Historia (la sala contada de corrido). Además, una película con las 15 salas encadenadas.
- **Cada idea viene explicada:** cada sala dice qué es ese cuarto y cada estación traduce la imagen en un «(De qué se trata: …)», sin ambigüedades.
- **Al lado de cada sala, el guion exacto** de lo que dice cada persona en la exposición (con los números ya reemplazados), para comparar con la historia del palacio. Lo de Mati va en violeta. Se abre con el código del grupo.

## Cómo estudiar

1. Leé la historia de la sala. 2. Recorré las estaciones imaginando la escena con todos los sentidos y diciendo la frase en voz alta. 3. Pasá a Ensayo y recordá antes de destapar. 4. Marcá «Lo sé» solo cuando te salga sin mirar. 5. Caminá las 15 salas de memoria.

Si tu gimnasio es distinto, cambiá los lugares por los del tuyo: lo único que importa es el orden.

## Cómo está armado

```
index.html              página única y autocontenida (sin pedidos externos; funciona sin conexión)
contenido/meta.json     título, personajes y preguntas frecuentes
contenido/salas/*.json  una sala por archivo, con sus estaciones
src/                    plantilla, estilos, lógica y el componente del código de 3 casillas
build.py                arma index.html
verificar.py            comprueba los números contra el TP
tools/cifrar_json.py    cifra el guion textual (AES-GCM; clave PBKDF2 del código)
privado/                guion textual de Mati: NO está en el repo (.gitignore)
```

```bash
python tools/generar_guion.py --tp ../trabajo_practico_AE2   # reparte el guion exacto del TP entre las salas (privado/)
python build.py                 # arma index.html
python build.py --codigo NNN    # además vuelve a cifrar privado/guion_mati.json con ese código de 3 dígitos
python verificar.py --tp ../trabajo_practico_AE2
```

`build.py --codigo` necesita Playwright con Chromium (cifra con la misma WebCrypto que después descifra el navegador). Para verlo en local, `python -m http.server`: WebCrypto no funciona con doble clic sobre el archivo (`file://`).

## Los números

`verificar.py` exige que cada cifra de cada estación aparezca tal cual en el README, la conclusión o el informe del TP, y que todo decimal del campo «dato» también. Las imágenes pueden redondear (2,52 por 2,5158) y el verificador lo avisa sin fallar. Si el TP cambia, hay que volver a correrlo.

## Privacidad

El guion textual no está en el texto de la página: viaja cifrado y se abre con el código del grupo. **No es seguridad fuerte**: con 3 dígitos, alguien con conocimientos técnicos puede probar las 1000 combinaciones. Sirve para que las frases exactas no queden a la vista de cualquiera. El código no figura en ningún archivo del repo y no se recuerda: hay que ponerlo cada vez que se abre la página.

No hay cuentas, cookies ni analítica. El progreso («Lo sé») se guarda en el navegador de cada persona y se borra con el botón del pie de página.

Los datos originales pertenecen a Data912 y al INDEC (vía datos.gob.ar).
