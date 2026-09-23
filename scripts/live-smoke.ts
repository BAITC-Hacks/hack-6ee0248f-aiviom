import "dotenv/config";
import {
  loadSourceDataset,
  buildProfile,
  validateImport,
} from "../src/domain/index.js";
import { recommend } from "../src/ai/index.js";
const d = loadSourceDataset();
const base = d.employees
  .map((e) => buildProfile(d, e.employee_id))
  .find((p) => p.candidates.filter((c) => c.eligible && c.U > 0).length >= 3)!;
const incoming = {
  ...base.employee,
  employee_id: "REGRESSION_LIVE_NEW",
  full_name: "New regression profile",
  manager_id: null,
};
const validation = validateImport(d, { employees: [incoming] });
if (!validation.valid) throw Error("Import invalid");
d.employees.push(...validation.employees);
const p = buildProfile(d, incoming.employee_id);
for (let i = 0; i < 3; i++) {
  const selected =
    i === 2
      ? buildProfile(d, incoming.employee_id, {
          goal: { target_role: incoming.role, target_grade: "Lead" },
        })
      : p;
  const started = performance.now();
  const r = await recommend(selected, {
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-5.4-mini",
  });
  console.log(
    JSON.stringify({
      run: i + 1,
      mode: r.mode,
      model: r.model,
      elapsed_ms: Math.round(performance.now() - started),
      recommendations: r.recommendations.map((x) => ({
        id: x.event_id,
        factors: x.factor_keys,
        evidence: x.evidence_ids.length,
        reason: x.reason,
        alternative: x.alternative_event_id,
      })),
      warnings: r.warnings,
      usage: r.usage,
    }),
  );
}
