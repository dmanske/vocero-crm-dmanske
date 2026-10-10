"use strict";
// CommonJS a propósito: webpack carga los loaders con require().
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Loader de webpack: traduce cada archivo de `src/` al compilar, con su
 * diccionario de `idiomas/<idioma>/`. Se registra en `idiomas/next.cjs`.
 */
const fs = require("node:fs");
const path = require("node:path");
const { traducir } = require("./transformar.cjs");

module.exports = function cargadorDeIdiomas(source) {
  const { idioma, raiz } = this.getOptions();
  const relativo = path.relative(raiz, this.resourcePath).split(path.sep).join("/");
  const diccionario = path.join(raiz, "idiomas", idioma, `${relativo}.json`);
  if (!fs.existsSync(diccionario)) {
    // Si el diccionario aparece después, webpack recompila el archivo solo.
    this.addMissingDependency(diccionario);
    return source;
  }
  this.addDependency(diccionario);
  let tabla;
  try {
    tabla = JSON.parse(fs.readFileSync(diccionario, "utf8"));
  } catch (err) {
    throw new Error(`[idiomas] ${path.relative(raiz, diccionario)} no es un JSON válido: ${err.message}`);
  }
  return traducir(source, this.resourcePath, tabla);
};
