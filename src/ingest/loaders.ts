import { PDFParse } from "pdf-parse";

import type { SeedSource, SourceDocument } from "../types/documents.js";
import { inferBenefitMetadata } from "../rag/inssCatalog.js";
import { normalizeWhitespace } from "../utils/text.js";
import { normalizeHtmlToText } from "./normalize.js";
import { buildSourceSearchText } from "./sourceHints.js";

export async function loadSource(source: SeedSource): Promise<SourceDocument> {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Failed to download source ${source.url}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const sourceType = source.type ?? (contentType.includes("pdf") ? "pdf" : "html");

  if (sourceType === "pdf") {
    const buffer = Buffer.from(await response.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const title = source.title ?? source.url;
    const tags = source.tags ?? [];
    const inferred = inferBenefitMetadata({
      title,
      url: source.url,
      tags,
    });

    return {
      url: source.url,
      title,
      text: normalizeWhitespace(parsed.text),
      sourceType,
      tags,
      priority: source.priority ?? 1,
      searchText: buildSourceSearchText({
        title,
        url: source.url,
        tags,
        benefitId: source.benefitId ?? inferred.benefitId,
        family: source.family ?? inferred.family,
        lifecycle: source.lifecycle ?? inferred.lifecycle,
        sourceKind: source.sourceKind ?? inferred.sourceKind,
        formCodes: source.formCodes,
      }),
      benefitId: source.benefitId ?? inferred.benefitId,
      family: source.family ?? inferred.family,
      lifecycle: source.lifecycle ?? inferred.lifecycle,
      sourceKind: source.sourceKind ?? inferred.sourceKind,
      requiresAuth: source.requiresAuth ?? inferred.requiresAuth,
      supportsSms: source.supportsSms ?? inferred.supportsSms,
      formCodes: source.formCodes,
    };
  }

  const html = await response.text();
  const normalized = normalizeHtmlToText(html);
  const title = source.title ?? normalized.title;
  const tags = source.tags ?? [];
  const inferred = inferBenefitMetadata({
    title,
    url: source.url,
    tags,
  });

  return {
    url: source.url,
    title,
    text: normalized.text,
    sourceType,
    tags,
    priority: source.priority ?? 1,
    searchText: buildSourceSearchText({
      title,
      url: source.url,
      tags,
      benefitId: source.benefitId ?? inferred.benefitId,
      family: source.family ?? inferred.family,
      lifecycle: source.lifecycle ?? inferred.lifecycle,
      sourceKind: source.sourceKind ?? inferred.sourceKind,
      formCodes: source.formCodes,
    }),
    benefitId: source.benefitId ?? inferred.benefitId,
    family: source.family ?? inferred.family,
    lifecycle: source.lifecycle ?? inferred.lifecycle,
    sourceKind: source.sourceKind ?? inferred.sourceKind,
    requiresAuth: source.requiresAuth ?? inferred.requiresAuth,
    supportsSms: source.supportsSms ?? inferred.supportsSms,
    formCodes: source.formCodes,
  };
}
