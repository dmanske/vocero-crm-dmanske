/**
 * Revisor de traducciones: qué textos de `src/` faltan en el diccionario y
 * cuáles quedaron viejos (el original cambió o borró ese texto).
 *
 * Es lo que se corre después de traer una actualización de kevinrivm/vocero-crm:
 *
 *   node idiomas/revisar.mjs                    # resumen por archivo
 *   node idiomas/revisar.mjs --detalle          # cada texto, con su línea
 *   node idiomas/revisar.mjs --archivo login    # solo archivos cuya ruta contenga "login"
 *   node idiomas/revisar.mjs --idioma pt-BR     # default: pt-BR
 *
 * Sale con 1 si hay traducciones con marcadores {0} incorrectos (romperían el build).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { analizar, ocurrencias, marcadores, traducir } = require("./transformar.cjs");

const RAIZ = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const idioma = opcion("--idioma") ?? "pt-BR";
const filtro = opcion("--archivo");
const detalle = args.includes("--detalle");

/** Carpetas que nunca ve una persona: mocks de desarrollo. */
const EXCLUIDAS = ["src/app/api/dev/", "src/server/dev/"];

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) && !nombre.endsWith(".d.ts") ? [ruta] : [];
  });
}

/**
 * ¿Parece texto para personas? Solo decide qué se REPORTA como faltante; lo
 * que se traduce lo decide el diccionario. Las clases de Tailwind, rutas,
 * claves internas en minúscula y constantes quedan fuera.
 */
function pareceTexto({ tipo, clave, atributo }) {
  if (tipo === "regex") {
    // Expresión que busca palabras de personas (p. ej. "hablar|asesor"): el
    // cliente brasileño las escribe en portugués. Sin escapes ni clases.
    const palabras = clave.replace(/\\[a-zA-Z]/g, " ").match(/\p{L}{4,}/gu) ?? [];
    return palabras.some((p) => /[áéíóúñ]/i.test(p) || !/^(https?|www|http|data|true|false|null|json|mailto|bsuid)$/i.test(p));
  }
  const limpio = clave.replace(/\{\d+\}/g, "").trim();
  if (!/\p{L}/u.test(limpio)) return false;
  if (tipo === "jsx") return true;
  if (atributo && ATRIBUTOS_TECNICOS.has(atributo)) return false;
  if (/^(https?:|\/|\.{1,2}\/|#|@\/|data:|mailto:)/.test(limpio)) return false;
  if (/[áéíóúñ¿¡…]/i.test(limpio)) return true;
  if (!/\s/.test(limpio)) {
    // Una palabra: es etiqueta si empieza en mayúscula y no es TODO_MAYÚSCULAS.
    return /^\p{Lu}\p{Ll}/u.test(limpio);
  }
  // Solo minúsculas sin acentos y alguna con guion o dos puntos: clases de
  // Tailwind o CSS («relative flex min-h-screen», «linear-gradient(…)»).
  const tokens = limpio.split(/\s+/);
  const css =
    tokens.every((t) => /^[!-]?[a-z0-9@[\]().:%/#_,'=>&*+-]+$/.test(t)) &&
    tokens.some((t) => /[-:[]/.test(t));
  return !css;
}

/** Atributos JSX cuyo valor nunca es texto para personas. */
const ATRIBUTOS_TECNICOS = new Set([
  "className",
  "style",
  "id",
  "htmlFor",
  "href",
  "src",
  "type",
  "name",
  "autoComplete",
  "inputMode",
  "rel",
  "target",
  "method",
  "role",
  "key",
  "accept",
  "data-theme",
  "lang",
]);

const resultado = [];
let erroresDeMarcadores = 0;

for (const ruta of archivos(path.join(RAIZ, "src"))) {
  const relativo = path.relative(RAIZ, ruta).split(path.sep).join("/");
  if (EXCLUIDAS.some((e) => relativo.startsWith(e))) continue;
  if (filtro && !relativo.includes(filtro)) continue;

  const fuente = readFileSync(ruta, "utf8");
  const sf = analizar(fuente, ruta);
  const textos = ocurrencias(sf);
  const rutaDic = path.join(RAIZ, "idiomas", idioma, `${relativo}.json`);
  let tabla = {};
  const errores = [];
  if (existsSync(rutaDic)) {
    try {
      tabla = JSON.parse(readFileSync(rutaDic, "utf8"));
    } catch (err) {
      errores.push(`JSON inválido: ${err.message}`);
    }
    // El código traducido tiene que seguir siendo código válido.
    try {
      const salida = analizar(traducir(fuente, ruta, tabla), ruta);
      for (const d of salida.parseDiagnostics ?? []) {
        errores.push(`o código traduzido não compila: ${typeof d.messageText === "string" ? d.messageText : d.messageText.messageText}`);
      }
    } catch (err) {
      errores.push(err.message);
    }
  }
  erroresDeMarcadores += errores.length;
  const claves = new Set(textos.map((t) => t.clave));

  const vistos = new Set();
  const faltantes = textos.filter((t) => {
    if (vistos.has(t.clave) || t.clave in tabla || !pareceTexto(t)) return false;
    vistos.add(t.clave);
    return true;
  });
  // "texto#2" = só a 2.ª aparição de "texto"; "chave:Nome" = nome de propriedade (ver transformar.cjs).
  const nomesDePropriedade = new Set(
    [...fuente.matchAll(/(?:^|[{,\s])["']?([\p{L}\p{N}_ ]+?)["']?\s*:/gmu)].map((m) => m[1].trim())
  );
  const viejas = Object.keys(tabla).filter((k) =>
    k.startsWith("chave:") ? !nomesDePropriedade.has(k.slice(6)) : !claves.has(k.replace(/#\d+$/, ""))
  );
  // Solo las plantillas tienen marcadores; en una cadena simple, {1} es texto.
  const valoresDe = new Map(textos.filter((t) => t.tipo === "plantilla").map((t) => [t.clave, t.valores]));
  const malas = Object.entries(tabla).filter(([k, v]) => {
    const base = k.replace(/#\d+$/, "");
    const n = valoresDe.get(base);
    if (typeof v !== "string" || n === undefined) return false;
    return marcadores(v, n).join(",") !== marcadores(base, n).join(",");
  });
  erroresDeMarcadores += malas.length;
  const traducidas = Object.values(tabla).filter((v) => typeof v === "string").length;

  if (faltantes.length || viejas.length || malas.length || errores.length || (filtro && traducidas)) {
    resultado.push({ relativo, faltantes, viejas, malas, errores, traducidas });
  }
}

const total = (campo) => resultado.reduce((n, r) => n + r[campo].length, 0);

for (const r of resultado.sort((a, b) => b.faltantes.length - a.faltantes.length)) {
  const partes = [`${r.faltantes.length} faltando`];
  if (r.viejas.length) partes.push(`${r.viejas.length} desatualizadas`);
  if (r.malas.length) partes.push(`${r.malas.length} com {n} errado`);
  if (r.errores.length) partes.push(`${r.errores.length} ERRO`);
  console.log(`${r.relativo} — ${partes.join(" · ")}`);
  for (const e of r.errores) console.log(`   ✗ ${e}`);
  if (detalle || filtro) {
    for (const f of r.faltantes) console.log(`   + L${f.linea} ${JSON.stringify(f.clave)}`);
    for (const v of r.viejas) console.log(`   - (não existe mais no código) ${JSON.stringify(v)}`);
    for (const [k, v] of r.malas) console.log(`   ! ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
  }
}

console.log(
  `\n[${idioma}] ${total("faltantes")} textos faltando · ${total("viejas")} traduções desatualizadas · ${erroresDeMarcadores} erros (marcador {n} ou código inválido)`
);
process.exit(erroresDeMarcadores > 0 ? 1 : 0);
