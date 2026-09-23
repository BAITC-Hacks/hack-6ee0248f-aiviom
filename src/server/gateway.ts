import type { Profile, RecommendationResult } from "../shared/types.js";
import { recommend } from "../ai/index.js";
const defaultUrl = "https://career.aiviom.ai";
const gatewayCookies = new Map<string, string>();
export async function judgeRecommendation(
  profile: Profile,
  workspace = "standalone",
): Promise<RecommendationResult> {
  const configured = process.env.JUDGE_GATEWAY_URL;
  if (configured === "off" || process.env.AI_MODE === "offline")
    return recommend(profile);
  const base = configured || defaultUrl;
  let gatewayCookie = gatewayCookies.get(workspace) || "";
  const deadline = Date.now() + 9500;
  const remaining = () => AbortSignal.timeout(Math.max(1, deadline - Date.now()));
  try {
    const endpoint = new URL(base);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "127.0.0.1")
      throw new Error("Unsafe gateway");
    if (!gatewayCookie) {
      const session = await fetch(new URL("/api/session", endpoint), {
        signal: remaining(),
      });
      if (!session.ok) throw new Error("Gateway session unavailable");
      gatewayCookie = session.headers.get("set-cookie")?.split(";")[0] || "";
      if (!gatewayCookie) throw new Error("Gateway scope unavailable");
      gatewayCookies.set(workspace, gatewayCookie);
      if (gatewayCookies.size > 200) gatewayCookies.delete(gatewayCookies.keys().next().value!);
    }
    const response = await fetch(new URL("/api/judge/recommend", endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: gatewayCookie },
      body: JSON.stringify({
        employee: {
          ...profile.employee,
          skills: profile.skills,
          last_review_date: profile.as_of,
        },
        history: profile.history,
        goal: profile.goal,
        as_of: profile.as_of,
      }),
      signal: remaining(),
    });
    const rotated = response.headers.get("set-cookie")?.split(";")[0];
    if (rotated) gatewayCookies.set(workspace, rotated);
    if (!response.ok) throw new Error("Gateway unavailable");
    const result = (await response.json()) as RecommendationResult;
    const eligible = new Set(
      profile.candidates
        .filter((c) => c.eligible && !c.event.mandatory)
        .map((c) => c.event.event_id),
    );
    if (
      !Array.isArray(result.recommendations) ||
      result.recommendations.some((r) => !eligible.has(r.event_id))
    )
      throw new Error("Gateway facts mismatch");
    return result;
  } catch {
    const result = await recommend(profile);
    return {
      ...result,
      warnings: [
        "Командный AI gateway недоступен; показан расчётный режим.",
        ...result.warnings,
      ],
    };
  }
}
