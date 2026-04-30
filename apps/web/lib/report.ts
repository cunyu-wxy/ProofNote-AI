export type RiskLevel = "low" | "medium" | "high";

export type ReportRisk = {
  level: RiskLevel;
  description: string;
  evidence: string;
};

export type GeneratedReport = {
  title: string;
  summary: string;
  key_points: string[];
  risks: ReportRisk[];
  conclusion: string;
};

export type GenerateReportInput = {
  title: string;
  sourceText: string;
  instruction: string;
};

export const reportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "key_points", "risks", "conclusion"],
  properties: {
    title: {
      type: "string",
      description: "Short report title derived from the user-provided title."
    },
    summary: {
      type: "string",
      description: "Concise executive summary of the uploaded source."
    },
    key_points: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "string"
      }
    },
    risks: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["level", "description", "evidence"],
        properties: {
          level: {
            type: "string",
            enum: ["low", "medium", "high"]
          },
          description: {
            type: "string"
          },
          evidence: {
            type: "string"
          }
        }
      }
    },
    conclusion: {
      type: "string",
      description: "Final conclusion based only on the uploaded source."
    }
  }
} as const;

const maxPreviewLength = 150;

function cleanLine(line: string) {
  return line.replace(/^[-#*>`\s]+/, "").trim();
}

function compactText(value: string, maxLength: number) {
  const compactValue = value.replace(/\s+/g, " ").trim();

  if (compactValue.length <= maxLength) {
    return compactValue;
  }

  return `${compactValue.slice(0, maxLength - 3).trim()}...`;
}

function ensureSentence(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function splitMeaningfulLines(sourceText: string) {
  return sourceText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 0);
}

function extractKeyPoints(sourceText: string, instruction: string) {
  const lines = splitMeaningfulLines(sourceText).filter(
    (line) => line.length >= 28
  );
  const keyPoints = lines
    .slice(0, 4)
    .map((line) => compactText(line, maxPreviewLength));

  if (instruction.trim()) {
    keyPoints.unshift(`Instruction focus: ${compactText(instruction, 120)}`);
  }

  if (keyPoints.length === 0) {
    keyPoints.push(compactText(sourceText, maxPreviewLength));
  }

  return keyPoints.slice(0, 5);
}

function findEvidence(sourceText: string, pattern: RegExp) {
  const matchingLine = splitMeaningfulLines(sourceText).find((line) =>
    pattern.test(line.toLowerCase())
  );

  return compactText(matchingLine ?? sourceText, 140);
}

function detectRisks(sourceText: string) {
  const normalizedSource = sourceText.toLowerCase();
  const risks: ReportRisk[] = [];

  if (/(risk|issue|blocker|fail|error|warning)/.test(normalizedSource)) {
    risks.push({
      level: "high",
      description:
        "The source includes explicit risk, failure, or warning language.",
      evidence: findEvidence(
        sourceText,
        /(risk|issue|blocker|fail|error|warning)/
      )
    });
  }

  if (/(todo|pending|unknown|tbd|draft|assumption)/.test(normalizedSource)) {
    risks.push({
      level: "medium",
      description:
        "The source includes unresolved, draft, or assumption-based content.",
      evidence: findEvidence(
        sourceText,
        /(todo|pending|unknown|tbd|draft|assumption)/
      )
    });
  }

  if (sourceText.length < 240) {
    risks.push({
      level: "medium",
      description: "The source is short, so the generated report has limited evidence.",
      evidence: compactText(sourceText, 140)
    });
  }

  if (risks.length === 0) {
    risks.push({
      level: "low",
      description: "No obvious risk keywords were detected in this fallback pass.",
      evidence: "Local keyword scan completed without high-risk matches."
    });
  }

  return risks.slice(0, 3);
}

export function buildMockReport({
  title,
  sourceText,
  instruction
}: GenerateReportInput): GeneratedReport {
  const reportTitle = title.trim() || "ProofNote report";
  const focus = instruction.trim()
    ? compactText(instruction, 140)
    : "Create a concise evidence-backed summary";

  return {
    title: reportTitle,
    summary: `${ensureSentence(
      focus
    )} This fallback report was generated locally from the uploaded source text and follows the ProofNote JSON schema.`,
    key_points: extractKeyPoints(sourceText, instruction),
    risks: detectRisks(sourceText),
    conclusion:
      "The report is ready for the next MVP phase: 0G Storage upload and on-chain registration."
  };
}

export function isGeneratedReport(value: unknown): value is GeneratedReport {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    Array.isArray(value.key_points) &&
    value.key_points.every((point) => typeof point === "string") &&
    Array.isArray(value.risks) &&
    value.risks.every(isReportRisk) &&
    typeof value.conclusion === "string"
  );
}

function isReportRisk(value: unknown): value is ReportRisk {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRiskLevel(value.level) &&
    typeof value.description === "string" &&
    typeof value.evidence === "string"
  );
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "low" || value === "medium" || value === "high";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
