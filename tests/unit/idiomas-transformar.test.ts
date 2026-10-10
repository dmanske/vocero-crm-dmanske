import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * Fork pt-BR — el traductor que corre al compilar (`idiomas/transformar.cjs`).
 * Si se equivoca, el build sale roto o con un texto donde no iba; estas
 * pruebas fijan qué toca y qué no.
 */
const require = createRequire(import.meta.url);
const { traducir, ocurrencias, analizar } = require("../../idiomas/transformar.cjs") as {
  traducir: (source: string, fileName: string, tabla: Record<string, string | null>) => string;
  ocurrencias: (sf: unknown) => { tipo: string; clave: string }[];
  analizar: (source: string, fileName: string) => unknown;
};

describe("idiomas: traducir", () => {
  it("traduce texto JSX y conserva los espacios de alrededor", () => {
    const src = `const a = <p>\n  ¿Primera vez aquí?{" "}\n  <b>Crear</b>\n</p>;`;
    const out = traducir(src, "a.tsx", { "¿Primera vez aquí?": "Primeira vez aqui?", Crear: "Criar" });
    expect(out).toBe(`const a = <p>\n  Primeira vez aqui?{" "}\n  <b>Criar</b>\n</p>;`);
  });

  it("colapsa los saltos de línea del texto JSX para buscar la clave", () => {
    const src = `const a = <p>\n  El primer registro crea\n  la organización.\n</p>;`;
    const out = traducir(src, "a.tsx", { "El primer registro crea la organización.": "O primeiro cadastro cria a organização." });
    expect(out).toContain("O primeiro cadastro cria a organização.");
  });

  it("un atributo JSX pasa a expresión para que las comillas no rompan nada", () => {
    const src = `const a = <button aria-label="Cerrar sesión" />;`;
    expect(traducir(src, "a.tsx", { "Cerrar sesión": 'Sair "agora"' })).toBe(
      `const a = <button aria-label={"Sair \\"agora\\""} />;`
    );
  });

  it("envuelve llaves y signos < > del texto JSX", () => {
    const src = `const a = <p>Hola</p>;`;
    expect(traducir(src, "a.tsx", { Hola: "Olá {nome}" })).toBe(`const a = <p>{"Olá {nome}"}</p>;`);
  });

  it("traduce plantillas con marcadores y permite cambiar el orden", () => {
    const src = "const t = `${n} caracteres de ${total}`;";
    expect(traducir(src, "a.ts", { "{0} caracteres de {1}": "de {1}, {0} caracteres" })).toBe(
      "const t = `de ${total}, ${n} caracteres`;"
    );
  });

  it("traduce también las cadenas dentro de la plantilla", () => {
    const src = 'const t = `Rol: ${owner ? "Propietario" : "Equipo"}`;';
    const out = traducir(src, "a.ts", { "Rol: {0}": "Papel: {0}", Propietario: "Proprietário", Equipo: "Equipe" });
    expect(out).toBe('const t = `Papel: ${owner ? "Proprietário" : "Equipe"}`;');
  });

  it("deja como texto las variables {{1}} de WhatsApp que no son valores de la plantilla", () => {
    const src = "const t = `Numeradas {{1}}, {{2}} (falta {{${n}}})`;";
    const out = traducir(src, "a.ts", { "Numeradas {{1}}, {{2}} (falta {{{0}}})": "Numeradas {{1}}, {{2}} (falta {{{0}}})" });
    expect(out).toBe("const t = `Numeradas {{1}}, {{2}} (falta {{${n}}})`;");
  });

  it("falla con un mensaje claro si la traducción pierde un marcador", () => {
    const src = "const t = `${n} caracteres`;";
    expect(() => traducir(src, "a.ts", { "{0} caracteres": "caracteres" })).toThrow(/\{0\}/);
  });

  it('"texto#2" traduce solo la segunda aparición y gana sobre "texto"', () => {
    const src = `const meses = ["mar"];\nconst dias = ["mar"];`;
    expect(traducir(src, "a.ts", { mar: "mar", "mar#2": "ter" })).toBe(`const meses = ["mar"];\nconst dias = ["ter"];`);
  });

  it("traduce expresiones regulares completas y rechaza las inválidas", () => {
    const src = "const pide = /(hablar|asesor)/i.test(t);";
    expect(traducir(src, "a.ts", { "/(hablar|asesor)/i": "/(hablar|falar|asesor|atendente)/i" })).toBe(
      "const pide = /(hablar|falar|asesor|atendente)/i.test(t);"
    );
    expect(() => traducir(src, "a.ts", { "/(hablar|asesor)/i": "/(falar/i" })).toThrow(/expresión/);
  });

  it('"chave:" traduce nombres de propiedad y nada más los toca', () => {
    const src = `const dot = { Nuevo: "a", "En conversación": "b", Cliente: "c" };`;
    const out = traducir(src, "a.ts", { "chave:Nuevo": "Novo", "chave:En conversación": "Em conversa", Nuevo: "X" });
    expect(out).toBe(`const dot = { "Novo": "a", "Em conversa": "b", Cliente: "c" };`);
  });

  it("null deja el texto como está", () => {
    const src = `if (e.key === "Escape") cerrar();`;
    expect(traducir(src, "a.ts", { Escape: null })).toBe(src);
  });

  it("nunca toca imports, tipos, nombres de propiedad ni directivas", () => {
    const src = [
      `"use client";`,
      `import x from "Bandeja";`,
      `type Rol = "Bandeja";`,
      `const o = { "Bandeja": 1 };`,
      `const v = o["Bandeja"];`,
      `const etiqueta = "Bandeja";`,
    ].join("\n");
    const out = traducir(src, "a.ts", { Bandeja: "Caixa de entrada" });
    expect(out.split("\n")).toEqual([
      `"use client";`,
      `import x from "Bandeja";`,
      `type Rol = "Bandeja";`,
      `const o = { "Bandeja": 1 };`,
      `const v = o["Bandeja"];`,
      `const etiqueta = "Caixa de entrada";`,
    ]);
  });

  it("sin coincidencias devuelve el mismo código", () => {
    const src = `const a = <p>Hola</p>;`;
    expect(traducir(src, "a.tsx", {})).toBe(src);
  });

  it("el revisor ve los mismos textos que traduce", () => {
    const src = "const a = <p title=\"Título\">Hola {`${n} días`}</p>;";
    const claves = ocurrencias(analizar(src, "a.tsx")).map((o) => o.clave);
    expect(claves).toEqual(["Título", "Hola", "{0} días"]);
  });
});
