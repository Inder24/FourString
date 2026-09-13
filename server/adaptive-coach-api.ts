import type { IncomingMessage, ServerResponse } from "node:http";
import { nodeMiddleware, jsonResponse, readRequestJson } from "./http-transport";
import { assessCaptureQuality, sanitizeCaptureEvidence } from "../src/capture-quality";
import {
  rhythmPattern,
  validateCoachingDecision,
  type CoachAttemptSummary,
  type CoachingDecision,
  type RhythmPatternId,
} from "../src/adaptive-coach";

interface OpenAIOutputItem {
  type?: string;
  name?: string;
  arguments?: string;
}

interface OpenAIResponse {
  output?: OpenAIOutputItem[];
  error?: { message?: string };
}

export function createAdaptiveCoachMiddleware(apiKey: string) {
  return nodeMiddleware(createAdaptiveCoachHandler(apiKey), ['/api/adaptive-coach', '/api/adaptive-coach/status']);
}

export function createAdaptiveCoachHandler(apiKey: string) {
  return async (request: Request): Promise<Response | null> => {
    const path = new URL(request.url).pathname;
    if (path === "/api/adaptive-coach/status") {
      return jsonResponse(200, { configured: Boolean(apiKey) });
    }
    if (path !== "/api/adaptive-coach") {
      return null;
    }
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed." });
    }
    if (!apiKey) {
      return jsonResponse(503, { error: "Add OPENAI_API_KEY to .env.local, then restart Vite." });
    }

    let summary: CoachAttemptSummary;
    try {
      const body = await readRequestJson(request, 20_000);
      const sanitized = sanitizeCoachAttemptSummary(body);
      if (!sanitized) throw new Error("Invalid attempt summary.");
      summary = sanitized;
    } catch (error) {
      return jsonResponse(400, { error: error instanceof Error ? error.message : "Invalid request." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const apiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-6-astra",
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 900,
          instructions: [
            "You are Four Strings, a calm beginner ukulele rhythm coach.",
            "Use only the numeric measurements supplied. Audio and strum direction are not available.",
            "Capture quality passed local heuristics, not a guarantee. Never diagnose hand technique or a player's ability from signal quality. Misses may include unrecognized attacks; avoid certainty about unobserved playing.",
            "Choose exactly one specific timing issue and one physical, encouraging correction.",
            "Focus on a valid contiguous two-to-four-slot section containing at least two played strokes.",
            "Choose a retry tempo no faster than the current tempo. Do not discuss chord or pitch accuracy.",
            "Your focus slots, tempo and repetitions control a synchronized illustrated C-chord demonstration before the next take; the pattern never changes.",
            "Select a visualCue for that demonstration: even-swing (steady wrist), relax-return (unhurried return), follow-pulse (land on cues), or air-stroke (keep moving silently through rests). These are teaching cues, not observations of a hand.",
            "Call configure_retry exactly once. Do not return prose outside the tool call.",
          ].join(" "),
          input: JSON.stringify(summary),
          tools: [configureRetryTool],
          tool_choice: { type: "function", name: "configure_retry" },
          parallel_tool_calls: false,
        }),
        signal: AbortSignal.any([controller.signal, request.signal]),
      });
      const payload = await apiResponse.json() as OpenAIResponse;
      if (!apiResponse.ok) {
        const message = apiResponse.status === 401
          ? "The OpenAI API key was rejected. Check .env.local and restart Vite."
          : apiResponse.status === 429
            ? "Astra is busy or the API limit was reached. Wait a moment, then retry analysis."
            : "Astra could not analyse this take. Retry in a moment.";
        return jsonResponse(apiResponse.status, { error: message });
        }
      const decision = extractCoachingDecision(payload, summary.patternId);
      if (!decision || decision.retryBpm > summary.bpm) {
        return jsonResponse(502, { error: "Astra returned an unusable coaching plan. Retry analysis." });
        }
      return jsonResponse(200, { decision });
    } catch (error) {
      return jsonResponse(504, {
        error: error instanceof DOMException && error.name === "AbortError"
          ? "Astra took too long to answer. Your take is safe—retry analysis."
          : "Astra could not be reached. Check your connection and retry analysis.",
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function extractCoachingDecision(payload: OpenAIResponse, patternId: RhythmPatternId): CoachingDecision | null {
  const calls = payload.output?.filter((item) => item.type === "function_call") ?? [];
  if (calls.length !== 1 || calls[0].name !== "configure_retry") return null;
  const toolCall = calls[0];
  if (!toolCall?.arguments) return null;
  try {
    return validateCoachingDecision(JSON.parse(toolCall.arguments), rhythmPattern(patternId));
  } catch {
    return null;
  }
}

const configureRetryTool = {
  type: "function",
  name: "configure_retry",
  description: "Choose one evidence-backed correction and configure the learner's next focused rhythm attempt.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      issue: {
        type: "string",
        enum: ["rushing", "dragging", "uneven", "missed_hits", "extra_hits"],
      },
      correction: {
        type: "string",
        description: "One concise, beginner-friendly physical instruction, no more than 180 characters.",
      },
      evidence: {
        type: "string",
        description: "One concise explanation grounded in the provided timing measurements, no more than 180 characters.",
      },
      focusStartSlot: { type: "integer", minimum: 0, maximum: 7 },
      focusEndSlot: { type: "integer", minimum: 0, maximum: 7 },
      retryBpm: { type: "integer", enum: [50, 55, 60, 65, 70] },
      repetitions: { type: "integer", enum: [2, 3] },
      visualCue: { type: "string", enum: ["even-swing", "relax-return", "follow-pulse", "air-stroke"] },
    },
    required: [
      "issue",
      "correction",
      "evidence",
      "focusStartSlot",
      "focusEndSlot",
      "retryBpm",
      "repetitions",
      "visualCue",
    ],
    additionalProperties: false,
  },
} as const;

export function sanitizeCoachAttemptSummary(value: unknown): CoachAttemptSummary | null {
  if (!isRecord(value)) return null;
  const patternIds: RhythmPatternId[] = ["steady-downs", "alternating-pulse", "island-rhythm"];
  if (!patternIds.includes(value.patternId as RhythmPatternId)) return null;
  const pattern = rhythmPattern(value.patternId as RhythmPatternId);
  if (!isFiniteNumber(value.bpm, 50, 70) || ![50, 55, 60, 65, 70].includes(value.bpm)) return null;
  if (!isInteger(value.retryCount, 0, 3) || !isRecord(value.metrics)) return null;
  const metrics = value.metrics;
  const captureQuality = sanitizeCaptureEvidence(value.captureQuality);
  if (!captureQuality || assessCaptureQuality(captureQuality).status !== "usable") return null;
  if (captureQuality.detectedCount !== metrics.detectedCount || captureQuality.expectedCount !== metrics.expectedCount) return null;
  const countKeys = ["expectedCount", "detectedCount", "onTime", "early", "late", "missed", "extra"] as const;
  if (!countKeys.every((key) => isInteger(metrics[key], 0, 100))) return null;
  if (!isFiniteNumber(metrics.meanAbsoluteErrorMs, 0, 5_000)) return null;
  if (!isFiniteNumber(metrics.meanBiasMs, -5_000, 5_000)) return null;
  if (!isFiniteNumber(metrics.timingVariationMs, 0, 5_000)) return null;
  if (!isFiniteNumber(metrics.toleranceMs, 1, 1_000)) return null;
  if (!Array.isArray(metrics.slotTiming) || metrics.slotTiming.length !== 8) return null;
  const slotTiming = metrics.slotTiming.map((candidate, slot) => {
    if (!isRecord(candidate) || candidate.slot !== slot) return null;
    if (candidate.deltaMs !== null && !isFiniteNumber(candidate.deltaMs, -5_000, 5_000)) return null;
    if (!isInteger(candidate.missed, 0, 10) || !isInteger(candidate.samples, 0, 10)) return null;
    return {
      slot,
      deltaMs: candidate.deltaMs as number | null,
      missed: candidate.missed as number,
      samples: candidate.samples as number,
    };
  });
  if (slotTiming.some((slot) => slot === null)) return null;
  if (!isFocusRegion(metrics.worstRegion)) return null;

  let previousAttempt: CoachAttemptSummary["previousAttempt"] = null;
  if (value.previousAttempt !== null) {
    if (!isRecord(value.previousAttempt)) return null;
    const previous = value.previousAttempt;
    if (!isFiniteNumber(previous.meanAbsoluteErrorMs, 0, 5_000)) return null;
    if (!["onTime", "missed", "extra"].every((key) => isInteger(previous[key], 0, 100))) return null;
    previousAttempt = {
      meanAbsoluteErrorMs: previous.meanAbsoluteErrorMs,
      onTime: previous.onTime as number,
      missed: previous.missed as number,
      extra: previous.extra as number,
    };
  }

  return {
    patternId: pattern.id,
    patternTitle: pattern.title,
    captureQuality,
    notation: pattern.notation,
    bpm: value.bpm,
    retryCount: value.retryCount,
    metrics: {
      expectedCount: metrics.expectedCount as number,
      detectedCount: metrics.detectedCount as number,
      meanAbsoluteErrorMs: metrics.meanAbsoluteErrorMs,
      meanBiasMs: metrics.meanBiasMs,
      timingVariationMs: metrics.timingVariationMs,
      onTime: metrics.onTime as number,
      early: metrics.early as number,
      late: metrics.late as number,
      missed: metrics.missed as number,
      extra: metrics.extra as number,
      toleranceMs: metrics.toleranceMs,
      slotTiming: slotTiming as CoachAttemptSummary["metrics"]["slotTiming"],
      worstRegion: {
        startSlot: metrics.worstRegion.startSlot as number,
        endSlot: metrics.worstRegion.endSlot as number,
      },
    },
    previousAttempt,
  };
}

function isFocusRegion(value: unknown): value is { startSlot: number; endSlot: number } {
  if (!isRecord(value) || !isInteger(value.startSlot, 0, 7) || !isInteger(value.endSlot, 0, 7)) return false;
  const span = value.endSlot - value.startSlot + 1;
  return span >= 2 && span <= 4;
}

function isFiniteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && isFiniteNumber(value, minimum, maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readJsonBody(request: IncomingMessage, maximumBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maximumBytes) {
        reject(new Error("Attempt summary is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Attempt summary must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

export function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}
