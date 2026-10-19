/*
 * Lector de la hoja "Gantt Control" (formato Constructora Londres).
 * Convierte la planilla semanal en el archivo data/avance.json que usa el dashboard.
 * Funciona en el navegador (window.GanttParser) y en Node (module.exports).
 *
 * Se aceptan los dos formatos de planilla en uso (se detectan solos):
 *   Formato A (abajo) y Formato B: A=Ítem B=Partida E=Inicio F=Término N=Unidad O=Incidencia,
 *   semanas desde Q, C3=viviendas, C4=fecha control, B7=obra, pesos de las filas resumen en D.
 *
 * Formato A de "Gantt Control":
 *   Fila 3 : fechas de inicio de cada semana (columna U, Z, AE, ... cada 5 columnas)
 *   Fila 5 : encabezados ("AV. REAL" en T, "AV. PROGRAMADO" en V, ...)
 *   F3 = cantidad de viviendas · F4 = fecha de control · E7 = nombre obra · I7 = término obra
 *   Desde fila 7: A=Resumen(Sí/No) B=Nivel D=Ítem E=Partida H=Inicio I=Término Q=Unidad R=Incidencia
 *   Bloque semanal (5 columnas desde T): real acumulado, real parcial, prog. acumulado, prog. parcial
 *   Filas resumen al final: OBRA, OBRAS PREVIAS, VIVIENDAS, URBANIZACIÓN, EQUIPAMIENTO (peso en columna G)
 */
(function (root) {
  "use strict";
  var STRIDE = 5;
  var MACROS = ["OBRAS PREVIAS", "VIVIENDAS", "URBANIZACIÓN", "EQUIPAMIENTO"];

  function serialToISO(v) {
    if (typeof v !== "number" || !isFinite(v) || v < 20000 || v > 80000) return null;
    var d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  function num(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }
  function round(v) { return Math.round(v * 1e6) / 1e6; }
  function txt(v) { return v === null || v === undefined ? "" : String(v).trim(); }

  function detectarFormato(cell) {
    if (txt(cell(4, 19)) === "AV. REAL" && txt(cell(4, 4)).toUpperCase() === "PARTIDA") return "A";
    if (txt(cell(4, 16)) === "AV. REAL" && txt(cell(4, 1)).toUpperCase() === "PARTIDA") return "B";
    if (txt(cell(4, 19)) === "AV. REAL") return "A";
    if (txt(cell(4, 16)) === "AV. REAL") return "B";
    return null;
  }

  // Formato A: columnas Resumen/Nivel/Ítem/Partida (Maturana, Venturelli, Pedro Luna II)
  var FMT_A = { item: 3, partida: 4, peso: 6, ini: 7, fin: 8, unidad: 16, incid: 17, semana0: 19, casas: [2, 5], fecha: [3, 5], obra: [6, 4], iniObra: [6, 7], finObra: [6, 8], celdaSem: "T5", celdaFecha: "F4" };
  // Formato B: columnas Ítem/Partida sin Resumen ni Nivel (Guillermo Feliú, Petit, Adriana Olguín)
  var FMT_B = { item: 0, partida: 1, peso: 3, ini: 4, fin: 5, unidad: 13, incid: 14, semana0: 16, casas: [2, 2], fecha: [3, 2], obra: [6, 1], iniObra: [6, 4], finObra: [6, 5], celdaSem: "Q5", celdaFecha: "C4" };

  // Formato B no trae la columna Nivel: se deduce del código de ítem.
  //  - ítem sin punto ("1", "3", "7") -> nivel 1 (frente)
  //  - ítem "x.y" -> nivel 2 (categoría); si "x" no coincide con el frente vigente y no existe fila título "x",
  //    se agrega el frente "x" (para "OG - ..." se usa el nombre OBRA GRUESA, como en la hoja Incidencia PPTO)
  //  - ítem "x.y.z" -> nivel 3 (subtítulo dentro de la categoría), salvo que no haya categoría vigente
  //    o que pertenezca al mismo frente con otra categoría "x.y" (entonces es nivel 2)
  function nivelesFormatoB(filas) {
    var out = [], L1 = null, L2 = null;
    filas.forEach(function (f) {
      if (f.hoja) { out.push(f); return; }
      var partes = f.item.split(".").filter(function (x) { return x !== ""; });
      var d = partes[0] || "";
      if (d === "0") { f.nivel = 0; out.push(f); return; }
      if (partes.length <= 1) { f.nivel = 1; L1 = f; L2 = null; out.push(f); return; }
      if (partes.length === 2) {
        if (!L1 || String(L1.item).split(".")[0] !== d) {
          var esOG = /^OG\s*-/i.test(f.partida);
          var sint = { fila: f.fila, nivel: 1, item: d, partida: esOG ? "OBRA GRUESA" : "ÍTEM " + d, hoja: false, implicito: true };
          out.push(sint); L1 = sint;
        }
        f.nivel = 2; L2 = f; out.push(f); return;
      }
      var pref = partes[0] + "." + partes[1];
      var mismoFrente = L1 && String(L1.item).split(".")[0] === d;
      if (!L2 || (mismoFrente && L2.item !== pref)) { f.nivel = 2; L2 = f; }
      else f.nivel = 3;
      out.push(f);
    });
    return out;
  }

  function parseGrid(grid, fuente) {
    var cell = function (r, c) { var row = grid[r]; return row ? (row[c] === undefined ? null : row[c]) : null; };
    var formato = detectarFormato(cell);
    if (!formato) throw new Error("La hoja no tiene el formato esperado: falta 'AV. REAL' en la celda T5 (o Q5) de 'Gantt Control'.");
    var K = formato === "A" ? FMT_A : FMT_B;
    var fechaControl = serialToISO(cell(K.fecha[0], K.fecha[1]));
    if (!fechaControl) throw new Error("No se encontró la FECHA CONTROL en la celda " + K.celdaFecha + ".");
    // --- semanas --- (se busca cada "AV. REAL" de la fila 5: tolera columnas insertadas entre semanas)
    var semanas = [], colsSem = [];
    var fila5 = grid[4] || [], vacias = 0;
    for (var c = K.semana0; c < fila5.length && vacias < 40; c++) {
      if (txt(cell(4, c)) !== "AV. REAL") { vacias++; continue; }
      vacias = 0;
      var iso = serialToISO(cell(2, c + 1));
      if (!iso) break;
      if (semanas.length && iso <= semanas[semanas.length - 1]) break;
      semanas.push(iso); colsSem.push(c);
      c += STRIDE - 1;
    }
    if (semanas.length < 2) throw new Error("No se encontraron las semanas (fila 3) en 'Gantt Control'.");
    var nw = semanas.length;
    function series(r, offset) {
      var out = new Array(nw);
      for (var j = 0; j < nw; j++) out[j] = round(num(cell(r, colsSem[j] + offset)));
      return out;
    }
    // --- filas ---
    var filas = [], resumen = {}, filaObra = -1;
    for (var r = 6; r < grid.length; r++) {
      var partida = txt(cell(r, K.partida));
      if (!partida) continue;
      var itemVacio = cell(r, K.item) === null || txt(cell(r, K.item)) === "";
      var sinNivel = formato === "A" ? cell(r, 1) === null : itemVacio;
      if (partida === "OBRA" && filaObra < 0 && sinNivel) { filaObra = r; }
      if (filaObra >= 0) {
        if (partida === "OBRA" || MACROS.indexOf(partida) >= 0) {
          resumen[partida] = { peso: partida === "OBRA" ? 1 : round(num(cell(r, K.peso))), real: series(r, 0), prog: series(r, 2) };
        }
        continue;
      }
      var esHoja = typeof cell(r, K.incid) === "number" && (formato === "B" || txt(cell(r, 0)) === "No");
      var nivel = formato === "A" ? cell(r, 1) : null;
      var f = {
        fila: r + 1,
        nivel: typeof nivel === "number" ? nivel : null,
        item: txt(cell(r, K.item)),
        partida: partida,
        hoja: esHoja
      };
      if (esHoja) {
        f.inicio = serialToISO(cell(r, K.ini));
        f.termino = serialToISO(cell(r, K.fin));
        f.unidad = txt(cell(r, K.unidad)) || "Global";
        f.incid = Math.round(num(cell(r, K.incid)) * 1e6) / 1e6;
        f.real = series(r, 0);
        f.prog = series(r, 2);
      }
      filas.push(f);
    }
    if (filaObra < 0 || !resumen.OBRA) throw new Error("No se encontró la fila resumen 'OBRA' al final de 'Gantt Control'.");
    MACROS.forEach(function (m) { if (!resumen[m]) throw new Error("Falta la fila resumen '" + m + "'."); });
    if (formato === "B") filas = nivelesFormatoB(filas);
    return {
      version: 1,
      formato: formato,
      fuente: fuente || "",
      generado: new Date().toISOString(),
      obra: txt(cell(K.obra[0], K.obra[1])),
      casas: num(cell(K.casas[0], K.casas[1])),
      fechaControl: fechaControl,
      inicioObra: serialToISO(cell(K.iniObra[0], K.iniObra[1])),
      terminoObra: serialToISO(cell(K.finObra[0], K.finObra[1])),
      semanas: semanas,
      resumen: resumen,
      filas: filas
    };
  }

  function parseWorkbook(XLSX, data, fuente) {
    var wb = XLSX.read(data, { type: "array", sheets: ["Gantt Control"], cellFormula: false, cellHTML: false, cellText: false, cellStyles: false });
    var ws = wb.Sheets["Gantt Control"];
    if (!ws) throw new Error("El archivo no tiene la hoja 'Gantt Control'.");
    var rg = XLSX.utils.decode_range(ws["!ref"]);
    rg.s.r = 0; rg.s.c = 0;               // leer siempre desde A1 para conservar filas/columnas
    ws["!ref"] = XLSX.utils.encode_range(rg);
    var grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    return parseGrid(grid, fuente);
  }

  var api = { parseGrid: parseGrid, parseWorkbook: parseWorkbook };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GanttParser = api;
})(this);
