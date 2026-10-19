# Dashboard de avance de obra – Guillermo Feliú (Chimbarongo)

Aplicación web estática (HTML + JavaScript) para analizar el avance semanal de la obra a partir de la planilla **Gantt Control**. Se publica gratis con **GitHub Pages**: no necesita servidor, base de datos ni licencias.

Todos los números vienen de la hoja "Gantt Control" del Gantt semanal. La app no inventa ni ingresa datos a mano.

## Qué muestra

| Pestaña | Contenido |
|---|---|
| **Resumen** | Avance real vs programado, diferencia, avance de la semana, SPI, ritmo de las últimas 4 semanas, ritmo requerido para terminar en la fecha del Gantt y fecha de término proyectada. Además: lectura rápida, curva S, avance semanal de las últimas 12 semanas, avance por frente y por categoría. |
| **Decisiones** | Partidas con mayor impacto en el atraso · partidas detenidas (3 semanas o más sin avance y bajo lo programado) · partidas que debían iniciar y no lo han hecho · partidas que inician en las próximas 4 semanas. |
| **Partidas** | Tabla completa con buscador, filtro por estado, orden por cualquier columna y descarga a CSV. |
| **Detalle y comparador** | Curva acumulada y ritmo semanal de una partida; comparación de hasta 6 partidas. |
| **Actualizar datos** | Carga del Gantt semanal y descarga del archivo `avance.json` para publicar. |

Los filtros **Semana de control** y **Frente** están arriba y aplican a todas las pestañas.

## Estructura de la carpeta

Todos los archivos van en la raíz del repositorio (sin carpetas):

```
index.html           página principal
styles.css           colores institucionales
parser.js            lee la hoja "Gantt Control" y genera avance.json
app.js               cálculos y gráficos
chart.umd.js         Chart.js 4.4.1 (incluida, no depende de internet)
xlsx.full.min.js     SheetJS 0.18.5 (incluida)
londres.png, conavicoop.png   logos
avance.json          datos publicados (Gantt 2026.10.16, control 18/10/2026)
```

## Publicar por primera vez (una sola vez)

1. En GitHub: **New repository** (ej. `dashboard-guillermo-feliu`).
2. **Add file → Upload files**, arrastre todos los archivos de esta carpeta y presione **Commit changes**.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. En 1 a 2 minutos queda disponible en `https://<usuario>.github.io/<repositorio>/`.

## Actualizar cada semana (2 minutos)

1. Abra la página publicada → pestaña **Actualizar datos**.
2. Seleccione el Gantt de la semana (ej. `2026.10.16 Gantt Guillermo Feliu Chimbarongo V1 1r.xlsx`). El archivo se lee en el navegador; no se sube a ningún servidor.
3. Revise que el dashboard muestre la nueva fecha de control.
4. Presione **Descargar avance.json**.
5. En GitHub, en la página principal del repositorio: **Add file → Upload files** → arrastre `avance.json` (reemplaza al anterior) → **Commit changes**.
6. En 1 a 2 minutos todos ven la semana nueva.

El Gantt ya trae la historia de todas las semanas, así que basta con subir el de la última. El selector "Semana de control" permite revisar semanas anteriores.

## Requisitos de la planilla

La app reconoce sola los dos formatos de "Gantt Control" que se usan en las obras:

- **Formato B (Guillermo Feliú):** A = Ítem, B = Partida, E = Inicio, F = Término, N = Unidad, O = Incidencia; C3 = viviendas, C4 = fecha de control, B7 = obra, E7/F7 = inicio/término; bloques semanales desde Q ("AV. REAL" en la fila 5, fecha en la fila 3); filas resumen OBRA, OBRAS PREVIAS, VIVIENDAS, URBANIZACIÓN y EQUIPAMIENTO al final, con el peso en la columna D.
- **Formato A (Pedro Luna II, Maturana, Venturelli):** A = Resumen, B = Nivel, D = Ítem, E = Partida, H/I = Inicio/Término, Q = Unidad, R = Incidencia; semanas desde T; pesos en G.

Cada semana se ubica buscando "AV. REAL" en la fila 5, así que no importa si se insertan columnas entre semanas.

En el formato B no hay columna Nivel. Los frentes y categorías se sacan del código de ítem:

- Ítem sin punto (1, 3, 7…): frente.
- Ítem x.y: categoría.
- Ítem x.y.z: subtítulo.

Las filas "OG - …" (ítems 2.x) no tienen fila título en el Gantt, así que se agrupan como **OBRA GRUESA**, igual que en la hoja Incidencia PPTO.

Si algo no calza, la app muestra qué celda falta y no carga datos incompletos.

## Cómo se calcula cada indicador

- **% Real / % Programado:** acumulado de la partida a la semana de control dividido por su total. El total es la cantidad de viviendas (o el programado final, si es mayor) para partidas en VIVIENDAS, y 100% para las demás.
- **Ritmo 4 semanas:** (real actual − real de hace 4 semanas) / 4.
- **Ritmo requerido:** pendiente / semanas hasta el término del Gantt. Si el término ya pasó, aparece "Vencida".
- **Semanas sin avance:** semanas consecutivas en que el real acumulado no cambió (solo partidas iniciadas y no terminadas).
- **Impacto (pts de obra):** (% real − % programado) × incidencia × peso del frente × 100.
- **Estados:**
  - Terminada.
  - Al día / adelantada.
  - Leve atraso: menos de 10 pts.
  - Atrasada: 10 pts o más.
  - Detenida: 3 semanas o más sin avance y bajo lo programado.
  - No iniciada (atrasada).
  - Por iniciar.
- **Indicadores de obra:** se toman de la fila resumen OBRA del Gantt.
- **Programado sin dato:** en este Gantt, las filas resumen tienen programado recién desde la semana del 21/09/2026; en las semanas anteriores está en 0. La app muestra esas semanas como "sin dato" y no como 0% programado.

## Importante: privacidad

Una página de GitHub Pages es **pública**: cualquiera con el enlace puede verla, aunque el repositorio sea privado (salvo GitHub Enterprise Cloud con control de acceso). Si el avance no debe ser público:

- no suba `data/avance.json` al repositorio;
- cada usuario carga el Gantt en la pestaña **Actualizar datos**. Funciona igual y el archivo nunca sale de su computador.
