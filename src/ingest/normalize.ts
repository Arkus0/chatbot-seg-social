import { load } from "cheerio";

import { normalizeWhitespace } from "../utils/text.js";

export function normalizeHtmlToText(html: string): { title: string; text: string } {
  const $ = load(html);

  $("script, style, noscript, header, footer, nav, aside, form").remove();

  const title = normalizeWhitespace($("title").first().text() || $("h1").first().text() || "Documento oficial");
  const main = $("main").first().length > 0 ? $("main").first() : $("body").first();
  const text = normalizeWhitespace(main.text());

  return {
    title,
    text,
  };
}
