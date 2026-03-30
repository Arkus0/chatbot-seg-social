import { load } from "cheerio";

import { normalizeWhitespace } from "../utils/text.js";

const CONTENT_SELECTORS = ["main#content", "#content", "main", "article", "[role='main']", "body"];
const TEXT_SELECTORS = "h1, h2, h3, h4, p, li, dt, dd, tr";

const STOP_SECTION_PATTERNS = [/^información relacionada$/i, /^informacion relacionada$/i, /^related information$/i];

const NOISE_PATTERNS = [
  /^cookies? notice$/i,
  /^this website uses cookies/i,
  /^accept all$/i,
  /^reject all$/i,
  /^display drop down/i,
  /^go to content$/i,
  /^search$/i,
  /^search engine$/i,
  /^advanced search tool$/i,
  /^the text to search must have at least/i,
  /^error:?$/i,
  /^en este navegador se ha inhabilitado javascript/i,
  /^rate this (page|content)/i,
  /^satisfaction survey$/i,
  /^encuesta de satisfacción$/i,
  /^valoración/i,
  /^star rating$/i,
  /^campos obligatorios$/i,
  /^did you find what you were looking for/i,
  /^your rating will be treated anonymously/i,
  /^thanks for your participation$/i,
  /^gracias por su participación$/i,
  /^together we can keep improving/i,
  /^juntos podemos seguir mejorando/i,
  /^\{\}$/i,
  /^\$\{.*\}$/i,
  /^copyright/i,
  /^aviso legal$/i,
  /^legal notice$/i,
  /^política de cookies$/i,
  /^cookies policy$/i,
  /^rss$/i,
  /^home$/i,
  /^inicio$/i,
  /^find out about us$/i,
  /^conócenos$/i,
  /^trabajadores$/i,
  /^workers$/i,
  /^pensionistas$/i,
  /^pensioners$/i,
  /^empresarios$/i,
  /^employers$/i,
  /^suggestions and complaints$/i,
  /^sugerencias y quejas$/i,
  /^enquiries$/i,
  /^consultas$/i,
  /^cómo identificarme$/i,
  /^how to identify myself$/i,
  /^mapa web$/i,
  /^site map$/i,
  /^glosario$/i,
  /^glossary$/i,
  /^enlaces$/i,
  /^links$/i,
  /^ayuda$/i,
  /^help$/i,
  /^accesibilidad$/i,
  /^accessibility$/i,
  /^información lingüística$/i,
  /^information on languages$/i,
  /^más información$/i,
  /^more information$/i,
];

function selectContentContainer($: ReturnType<typeof load>) {
  for (const selector of CONTENT_SELECTORS) {
    const container = $(selector).first();
    if (container.length > 0 && normalizeWhitespace(container.text()).length > 200) {
      return container;
    }
  }

  return $("body").first();
}

function isNoiseLine(text: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function formatElementText(tagName: string, text: string): string {
  if (tagName === "li" || tagName === "dt" || tagName === "dd" || tagName === "tr") {
    return `- ${text}`;
  }

  if (tagName.startsWith("h")) {
    const level = Number(tagName.slice(1));
    return `${"#".repeat(Number.isNaN(level) ? 2 : Math.min(Math.max(level, 1), 4))} ${text}`;
  }

  return text;
}

export function normalizeHtmlToText(html: string): { title: string; text: string } {
  const $ = load(html);

  $("script, style, noscript, header, footer, nav, aside, form, img, svg, iframe, button, input, select, textarea").remove();

  const title = normalizeWhitespace($("h1").first().text() || $("title").first().text() || "Documento oficial");
  const container = selectContentContainer($);
  const lines: string[] = [];
  const occurrences = new Map<string, number>();

  container.find(TEXT_SELECTORS).each((_, element) => {
    const node = $(element);
    const tagName = element.tagName.toLowerCase();
    const rawText =
      tagName === "tr"
        ? normalizeWhitespace(
            node
              .find("th, td")
              .map((__, child) => $(child).text())
              .get()
              .join(" | "),
          )
        : normalizeWhitespace(node.text());

    if (!rawText || isNoiseLine(rawText)) {
      return;
    }

    if (STOP_SECTION_PATTERNS.some((pattern) => pattern.test(rawText))) {
      return false;
    }

    const count = occurrences.get(rawText) ?? 0;
    if (count >= 2) {
      return;
    }
    occurrences.set(rawText, count + 1);

    const formatted = formatElementText(tagName, rawText);
    if (lines.at(-1) === formatted) {
      return;
    }

    lines.push(formatted);
  });

  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    title,
    text: normalizeWhitespace(text.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n")),
  };
}
