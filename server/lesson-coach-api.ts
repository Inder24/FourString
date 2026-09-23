import { courseLesson, type CourseActivity } from "../src/course";
import {
  validateLessonCoachDecision,
  type LessonCoachDecision,
  type LessonCoachSummary,
} from "../src/lesson-coach";
import { jsonResponse, nodeMiddleware, readRequestJson } from "./http-transport";

interface OpenAIOutputItem {
  type?: string;
  name?: string;
  arguments?: string;
}

interface OpenAIResponse {
  output?: OpenAIOutputItem[];
}

export function createLessonCoachMiddleware(apiKey: string, provider: typeof fetch = fetch) {
  return nodeMiddleware(createLessonCoachHandler(apiKey, provider), ["/api/lesson-coach", "/api/lesson-coach/status"]);
}

export function createLessonCoachHandler(apiKey: string, provider: typeof fetch = fetch) {
  return async (request: Request): Promise<Response | null> => {
    const path = new URL(request.url).pathname;
    if (path === "/api/lesson-coach/status") return jsonResponse(200, { configured: Boolean(apiKey) });
    if (path !== "/api/lesson-coach") return null;
    if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed." });
    if (!apiKey) return jsonResponse(503, { error: "Astra coaching is not configured. The lesson still works without it." });

    let summary: LessonCoachSummary;
    try {
      const sanitized = sanitizeLessonCoachSummary(await readRequestJson(request, 16_000));
      if (!sanitized) throw new Error("Invalid lesson evidence.");
      summary = sanitized;
    } catch (error) {
      return jsonResponse(400, { error: error instanceof Error ? error.message : "Invalid lesson evidence." });
    }

    const lesson = courseLesson(summary.lessonId);
    const allowedRetries = lesson.activities
      .filter((activity) => activity.stage === "play" || activity.stage === "check")
      .map((activity) => ({ id: activity.id, kind: activity.kind, bpm: "bpm" in activity ? activity.bpm : null }));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await provider("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-6-astra",
          store: false,
          reasoning: { effort: "low" },
          max_output_tokens: 650,
          instructions: [
            "You are a calm beginner ukulele method-book coach.",
            "Use only the supplied lesson metadata and numeric or boolean evidence; you cannot hear audio or observe fingering.",
            "Give exactly one short correction grounded in the evidence and select one allowed retry activity.",
            "If tempo applies, choose 40 BPM through the activity tempo; otherwise use null.",
            "Never invent measurements or claim a direction, chord, pitch, posture, or hand motion was observed.",
            "Call configure_lesson_retry exactly once and return no prose outside the tool call.",
          ].join(" "),
          input: JSON.stringify({ lessonTitle: lesson.title, objective: lesson.objective, summary, allowedRetries }),
          tools: [configureLessonRetryTool],
          tool_choice: { type: "function", name: "configure_lesson_retry" },
          parallel_tool_calls: false,
        }),
        signal: AbortSignal.any([controller.signal, request.signal]),
      });
      if (!response.ok) {
        return jsonResponse(response.status, {
          error: response.status === 429
            ? "Astra is busy. Keep practising or retry the coaching card shortly."
            : "Astra coaching is unavailable. Your lesson progress is safe.",
        });
      }
      const decision = extractLessonCoachDecision(await response.json() as OpenAIResponse, summary);
      if (!decision) return jsonResponse(502, { error: "Astra returned an unusable retry. The lesson can continue without it." });
      return jsonResponse(200, { decision });
    } catch (error) {
      return jsonResponse(504, {
        error: error instanceof DOMException && error.name === "AbortError"
          ? "Astra took too long. Continue the lesson or retry coaching."
          : "Astra could not be reached. Continue the lesson or retry coaching.",
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function sanitizeLessonCoachSummary(value: unknown): LessonCoachSummary | null {
  if (!isRecord(value) || typeof value.lessonId !== "string" || typeof value.activityId !== "string") return null;
  let lesson;
  try {
    lesson = courseLesson(value.lessonId);
  } catch {
    return null;
  }
  const activity = lesson.activities.find((candidate) => candidate.id === value.activityId);
  if (!activity || value.activityKind !== activity.kind) return null;
  if (typeof value.attempted !== "boolean" || typeof value.secure !== "boolean") return null;
  if (value.accuracy !== null && (!isFiniteNumber(value.accuracy) || value.accuracy < 0 || value.accuracy > 1)) return null;
  if (!isRecord(value.evidence)) return null;
  const evidence = Object.fromEntries(Object.entries(value.evidence).filter((entry): entry is [string, number | string | boolean] => {
    const candidate = entry[1];
    return typeof candidate === "string" || typeof candidate === "boolean" || isFiniteNumber(candidate);
  }));
  return {
    lessonId: lesson.id,
    activityId: activity.id,
    activityKind: activity.kind as CourseActivity["kind"],
    attempted: value.attempted,
    secure: value.secure,
    accuracy: value.accuracy as number | null,
    evidence,
  };
}

export function extractLessonCoachDecision(
  payload: OpenAIResponse,
  summary: LessonCoachSummary,
): LessonCoachDecision | null {
  const calls = payload.output?.filter((item) => item.type === "function_call") ?? [];
  if (calls.length !== 1 || calls[0].name !== "configure_lesson_retry" || !calls[0].arguments) return null;
  try {
    return validateLessonCoachDecision(JSON.parse(calls[0].arguments), summary);
  } catch {
    return null;
  }
}

const configureLessonRetryTool = {
  type: "function",
  name: "configure_lesson_retry",
  description: "Choose one evidence-based correction and an existing activity to retry.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      correction: { type: "string", description: "One beginner-friendly correction, at most 180 characters." },
      evidence: { type: "string", description: "One explanation using only supplied evidence, at most 180 characters." },
      retryActivityId: { type: "string" },
      tempoBpm: { type: ["integer", "null"], minimum: 40, maximum: 120 },
      repetitions: { type: "integer", enum: [1, 2, 3] },
    },
    required: ["correction", "evidence", "retryActivityId", "tempoBpm", "repetitions"],
    additionalProperties: false,
  },
} as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
