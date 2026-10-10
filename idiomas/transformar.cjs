"use strict";
// CommonJS a propósito: webpack carga los loaders con require().
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Núcleo del sistema de idiomas del fork (pt-BR).
 *
 * El código de `src/` NO se toca: sigue en español, igual que el original, para
 * que traer cambios de kevinrivm/vocero-crm no choque con la traducción. La
 * traducción se aplica al COMPILAR: este módulo lee un archivo de `src/`, busca
 * cada texto que tiene traducción en su diccionario y lo reemplaza en la copia
 * que se compila. El archivo en disco no cambia.
 *
 * Diccionario: `idiomas/<idioma>/<ruta del archivo>.json`, un objeto
 * `{ "texto en español": "texto traducido" }`. Valor `null` = revisado, se
 * queda como está (p. ej. una clave interna que parece texto).
 *
 * Qué se traduce, y la clave con que se busca:
 * - texto JSX:            <h1>Crear cuenta</h1>      → "Crear cuenta" (espacios colapsados)
 * - cadenas y atributos:  "Cerrar sesión"            → "Cerrar sesión" (exacta)
 * - plantillas:           `${n} caracteres`          → "{0} caracteres"
 *
 * Nunca se tocan: imports, tipos literales, nombres de propiedad, directivas
 * ("use client") ni argumentos de `require`/`import()`.
 */
const ts = require("typescript");

function analizar(source, fileName) {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
}

/** Clave del texto JSX: los espacios y saltos de línea se colapsan, como en el navegador. */
function normalizar(texto) {
  return texto.replace(/\s+/g, " ").trim();
}

/** `Hola ${nombre}, tienes ${n}` → "Hola {0}, tienes {1}". */
function claveDePlantilla(node) {
  let clave = node.head.text;
  node.templateSpans.forEach((span, i) => {
    clave += `{${i}}` + span.literal.text;
  });
  return clave;
}

/** Posiciones donde una cadena no es texto para personas. */
function omitir(node) {
  const p = node.parent;
  if (!p) return true;
  if (
    ts.isImportDeclaration(p) ||
    ts.isExportDeclaration(p) ||
    ts.isExternalModuleReference(p) ||
    ts.isLiteralTypeNode(p) ||
    ts.isExpressionStatement(p) ||
    ts.isTaggedTemplateExpression(p) ||
    ts.isModuleDeclaration(p)
  ) {
    return true;
  }
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  if (
    (ts.isPropertyAssignment(p) ||
      ts.isPropertySignature(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isEnumMember(p)) &&
    p.name === node
  ) {
    return true;
  }
  if (
    ts.isCallExpression(p) &&
    (p.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(p.expression) && p.expression.text === "require"))
  ) {
    return true;
  }
  return false;
}

/** Todos los textos candidatos del archivo, en orden. Lo usa el revisor. */
function ocurrencias(sf) {
  const lista = [];
  const visitar = (node) => {
    if (ts.isJsxText(node)) {
      const clave = normalizar(sf.text.slice(node.pos, node.end));
      if (clave) lista.push({ tipo: "jsx", clave, linea: linea(sf, node.pos) });
      return;
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !omitir(node)) {
      const atributo = ts.isJsxAttribute(node.parent) ? node.parent.name.getText(sf) : undefined;
      lista.push({
        tipo: atributo ? "atributo" : "cadena",
        atributo,
        clave: node.text,
        linea: linea(sf, node.getStart(sf)),
      });
      return;
    }
    if (ts.isTemplateExpression(node) && !omitir(node)) {
      lista.push({
        tipo: "plantilla",
        clave: claveDePlantilla(node),
        valores: node.templateSpans.length,
        linea: linea(sf, node.getStart(sf)),
      });
      // Sigue bajando: dentro de `${...}` puede haber más textos.
    }
    ts.forEachChild(node, visitar);
  };
  visitar(sf);
  return lista;
}

function linea(sf, pos) {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

/**
 * Los marcadores {0}…{n-1} de una frase de plantilla con `n` valores, sin
 * repetir y ordenados. Un {k} con k ≥ n es texto literal: así conviven con las
 * variables de WhatsApp, p. ej. «falta {{{0}}}» con un valor tiene el marcador
 * {0} y deja «{{1}}» como texto.
 */
function marcadores(texto, n) {
  const usados = [...texto.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])).filter((k) => k < n);
  return [...new Set(usados)].sort((a, b) => a - b);
}

function escaparPlantilla(texto) {
  return texto.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function armarPlantilla(traduccion, expresiones, clave) {
  const n = expresiones.length;
  const usados = marcadores(traduccion, n);
  const esperados = expresiones.map((_, i) => i);
  if (usados.join(",") !== esperados.join(",")) {
    throw new Error(
      `[idiomas] La traducción de "${clave}" debe usar exactamente {${esperados.join("}, {")}} y usa ${
        usados.length ? `{${usados.join("}, {")}}` : "ninguno"
      }: "${traduccion}"`
    );
  }
  let salida = "`";
  let desde = 0;
  for (const m of traduccion.matchAll(/\{(\d+)\}/g)) {
    const k = Number(m[1]);
    if (k >= n) continue; // texto literal, p. ej. {{1}} de WhatsApp
    salida += escaparPlantilla(traduccion.slice(desde, m.index)) + "${" + expresiones[k] + "}";
    desde = m.index + m[0].length;
  }
  return salida + escaparPlantilla(traduccion.slice(desde)) + "`";
}

function aplicar(texto, ediciones, inicio, fin) {
  let salida = texto.slice(inicio, fin);
  for (const e of [...ediciones].sort((a, b) => b.start - a.start)) {
    salida = salida.slice(0, e.start - inicio) + e.texto + salida.slice(e.end - inicio);
  }
  return salida;
}

/**
 * `"texto#2"` traduce solo la 2.ª aparición de «texto» en el archivo (en orden
 * de lectura) y gana sobre `"texto"`. Sirve cuando la misma palabra cumple dos
 * papeles, p. ej. "mar" = marzo y "mar" = martes.
 */
function ediciones(sf, raiz, tabla, contador = new Map()) {
  const lista = [];
  const tiene = (k) => Object.prototype.hasOwnProperty.call(tabla, k);
  const traduccionDe = (clave) => {
    const n = (contador.get(clave) ?? 0) + 1;
    contador.set(clave, n);
    const t = tiene(`${clave}#${n}`) ? tabla[`${clave}#${n}`] : tiene(clave) ? tabla[clave] : undefined;
    return typeof t === "string" ? t : undefined;
  };
  const visitar = (node) => {
    if (ts.isJsxText(node)) {
      const crudo = sf.text.slice(node.pos, node.end);
      const t = traduccionDe(normalizar(crudo));
      if (t !== undefined) {
        const antes = /^\s*/.exec(crudo)[0];
        const despues = /\s*$/.exec(crudo)[0];
        // `{`, `}`, `<` y `>` no pueden ir sueltos en JSX: se envuelven como expresión.
        const cuerpo = /[{}<>]/.test(t) ? `{${JSON.stringify(t)}}` : t;
        lista.push({ start: node.pos, end: node.end, texto: antes + cuerpo + despues });
      }
      return;
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !omitir(node)) {
      const t = traduccionDe(node.text);
      if (t !== undefined) {
        const literal = JSON.stringify(t);
        // En un atributo JSX las comillas no admiten escapes: va como expresión.
        const texto = ts.isJsxAttribute(node.parent) ? `{${literal}}` : literal;
        lista.push({ start: node.getStart(sf), end: node.end, texto });
      }
      return;
    }
    if (ts.isTemplateExpression(node) && !omitir(node)) {
      const clave = claveDePlantilla(node);
      const t = traduccionDe(clave);
      if (t !== undefined) {
        const expresiones = node.templateSpans.map((span) =>
          aplicar(
            sf.text,
            ediciones(sf, span.expression, tabla, contador),
            span.expression.getStart(sf),
            span.expression.end
          )
        );
        lista.push({ start: node.getStart(sf), end: node.end, texto: armarPlantilla(t, expresiones, clave) });
        return;
      }
    }
    ts.forEachChild(node, visitar);
  };
  visitar(raiz);
  return lista;
}

/** Devuelve el código con los textos traducidos. Sin coincidencias, el mismo código. */
function traducir(source, fileName, tabla) {
  const sf = analizar(source, fileName);
  const lista = ediciones(sf, sf, tabla);
  if (lista.length === 0) return source;
  return aplicar(source, lista, 0, source.length);
}

module.exports = { analizar, ocurrencias, traducir, normalizar, marcadores };
