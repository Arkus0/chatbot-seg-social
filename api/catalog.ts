import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getDemoQuestion, getGuidedProcedureLibrary } from "../src/rag/inssCatalog.js";

export default function catalogHandler(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({
    ok: true,
    procedureLibrary: getGuidedProcedureLibrary(),
    demoQuestion: getDemoQuestion(),
  });
}
