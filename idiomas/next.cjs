"use strict";
// CommonJS a propósito: lo importa next.config.ts y registra un loader de webpack.
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Enciende la traducción en la configuración de Next.
 *
 * `IDIOMA` (en `.env` o en la plataforma, disponible AL CONSTRUIR) elige el
 * idioma de la instancia: vacío o `es` = español, el comportamiento original;
 * `pt-BR` = portugués de Brasil. Una carpeta por idioma en `idiomas/`.
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");

/**
 * @template T
 * @param {T} config
 * @returns {T}
 */
module.exports = function comIdiomas(config) {
  const idioma = (process.env.IDIOMA ?? "").trim();
  if (idioma === "" || idioma === "es") return config;
  if (!/^[A-Za-z-]+$/.test(idioma) || !fs.existsSync(path.join(RAIZ, "idiomas", idioma))) {
    throw new Error(`[idiomas] IDIOMA=${idioma}: no existe la carpeta idiomas/${idioma}/`);
  }
  /** @type {any} */
  const original = config;
  return {
    ...original,
    webpack(webpackConfig, context) {
      const salida = original.webpack ? original.webpack(webpackConfig, context) : webpackConfig;
      salida.module.rules.unshift({
        test: /\.(ts|tsx)$/,
        include: path.join(RAIZ, "src"),
        // `pre`: corre sobre el código fuente, antes de que SWC lo compile.
        enforce: "pre",
        use: [{ loader: path.join(__dirname, "loader.cjs"), options: { idioma, raiz: RAIZ } }],
      });
      return salida;
    },
  };
};
