import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const read = (path) => readFileSync(join(root, path), "utf8");

const checks = [];

const addCheck = (name, pass, detail) => {
  checks.push({ name, pass, detail });
};

const listFiles = (directory, predicate = () => true) => {
  const files = [];
  const visit = (relativeDirectory) => {
    for (const entry of readdirSync(join(root, relativeDirectory), {
      withFileTypes: true,
    })) {
      const relativePath = join(relativeDirectory, entry.name);

      if (entry.isDirectory()) {
        visit(relativePath);
        continue;
      }

      if (entry.isFile() && predicate(relativePath)) {
        files.push(relativePath);
      }
    }
  };

  if (existsSync(join(root, directory))) {
    visit(directory);
  }

  return files;
};

const gitListedFiles = (args) => {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
};

const repositoryTextFiles = () =>
  Array.from(
    new Set([
      ...gitListedFiles(["ls-files"]),
      ...gitListedFiles(["ls-files", "--others", "--exclude-standard"]),
    ]),
  );

const requiredFiles = [
  "AGENTS.md",
  "docs/agent-harness.md",
  "docs/project-knowledge-base.md",
  "docs/project-build-plan.md",
  "docs/mcp-tooling.md",
  ".github/workflows/ci.yml",
];

for (const file of requiredFiles) {
  addCheck(
    `required file: ${file}`,
    existsSync(join(root, file)),
    "Create or restore the file.",
  );
}

const agents = read("AGENTS.md");
const agentLines = agents.trimEnd().split("\n").length;
addCheck(
  "AGENTS.md stays navigational",
  agentLines <= 120,
  `AGENTS.md has ${agentLines} lines; keep durable rules in docs/.`,
);

for (const linkedDoc of [
  "docs/project-knowledge-base.md",
  "docs/project-build-plan.md",
  "docs/agent-harness.md",
  "docs/architecture/overview.md",
  "docs/mcp-tooling.md",
]) {
  addCheck(
    `AGENTS.md links ${linkedDoc}`,
    agents.includes(linkedDoc),
    "Keep AGENTS.md as the short entry map for agents.",
  );
}

const knowledgeBase = read("docs/project-knowledge-base.md");
addCheck(
  "knowledge base does not treat AGENTS.md as detailed source of truth",
  !knowledgeBase.includes("docs/architecture` and `AGENTS.md"),
  "Point detailed source of truth to docs/ and keep AGENTS.md as a map.",
);

const harness = read("docs/agent-harness.md");
for (const phrase of [
  "AGENTS.md is only a map",
  "When a rule becomes important enough",
  "The root npm workspace commands do not cover the Python AI service",
]) {
  addCheck(
    `agent harness documents: ${phrase}`,
    harness.includes(phrase),
    "Keep the harness doc explicit about maps, mechanical checks, and Python validation.",
  );
}

const mcpTooling = read("docs/mcp-tooling.md");
addCheck(
  "MCP tooling has Codex setup section",
  mcpTooling.includes("## Codex Setup"),
  "Document the active Codex MCP/tooling path before legacy editor-specific setup.",
);
addCheck(
  "MCP tooling is not Claude-only",
  !mcpTooling.includes(
    "All configured entries are in `~/Library/Application Support/Claude/claude_desktop_config.json`.",
  ),
  "Avoid making Claude Desktop the primary setup path for this Codex project.",
);

const packageEntryPoints = listFiles("packages", (path) =>
  path.endsWith("/src/index.ts"),
);
const allowedBarrelLine =
  /^(?:export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["'][^"']+["'];?|\/\/.*|\/\*.*\*\/|)$/s;
const barrelViolations = [];

for (const entryPoint of packageEntryPoints) {
  const invalidLines = read(entryPoint)
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => !allowedBarrelLine.test(line));

  if (invalidLines.length > 0) {
    barrelViolations.push(`${entryPoint}:${invalidLines[0].number}`);
  }
}

addCheck(
  "package src/index.ts entrypoints are re-export barrels",
  barrelViolations.length === 0,
  barrelViolations.length === 0
    ? "Keep package entrypoints as simple barrels."
    : `${barrelViolations[0]} contains implementation code. Move logic into a domain module and export it from this barrel.`,
);

const frontendFiles = listFiles(
  "apps/web/src",
  (path) => path.endsWith(".ts") || path.endsWith(".tsx"),
);
const importSpecifierPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const forbiddenFrontendImports = [
  {
    label: "API workspace internals",
    matches: (specifier) =>
      specifier === "@marketplace/api" ||
      specifier.startsWith("@marketplace/api/") ||
      specifier.includes("apps/api") ||
      specifier.includes("/api/src/"),
  },
  {
    label: "AI service internals",
    matches: (specifier) =>
      specifier.includes("apps/ai-service") ||
      specifier.includes("ai-service/app") ||
      specifier.includes("/ai-service/"),
  },
  {
    label: "server-only provider code",
    matches: (specifier) =>
      /\b(paytr|resend|service-role|serviceRole|secret-manager|cloud-tasks)\b/i.test(
        specifier,
      ),
  },
];
const frontendImportViolations = [];

for (const file of frontendFiles) {
  const source = read(file);

  for (const match of source.matchAll(importSpecifierPattern)) {
    const specifier = match[1] ?? match[2];
    const forbiddenImport = forbiddenFrontendImports.find((rule) =>
      rule.matches(specifier),
    );

    if (forbiddenImport) {
      frontendImportViolations.push(
        `${file} imports ${specifier} (${forbiddenImport.label})`,
      );
    }
  }
}

addCheck(
  "frontend imports stay browser-safe",
  frontendImportViolations.length === 0,
  frontendImportViolations.length === 0
    ? "Frontend imports must stay limited to browser-safe app modules and shared contracts."
    : `${frontendImportViolations[0]}. Move privileged PayTR, Resend, service-role, AI-service, and backend logic behind the Fastify API.`,
);

const textFileExtensions = new Set([
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const extensionOf = (path) => {
  const lastSlash = path.lastIndexOf("/");
  const lastDot = path.lastIndexOf(".");
  return lastDot > lastSlash ? path.slice(lastDot) : "";
};
const sensitivePatterns = [
  {
    label: "server secret environment value",
    pattern:
      /\b(?:SUPABASE_SERVICE_ROLE_KEY|PAYTR_MERCHANT_KEY|PAYTR_MERCHANT_SALT|RESEND_WEBHOOK_SECRET|AI_INTERNAL_TOKEN|SENTRY_AUTH_TOKEN)\s*[:=]\s*["']?(?![A-Z0-9_]*PLACEHOLDER\b|placeholder\b|example\b|changeme\b|secret\b|service\b|test\b|local\b|your-|<)[A-Za-z0-9_./+=:-]{20,}/gi,
    explain:
      "Remove the committed secret value and keep provider credentials in local env, CI secrets, or Secret Manager.",
  },
  {
    label: "Supabase service-role JWT",
    pattern:
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
    explain:
      "Remove the committed JWT and load Supabase service-role keys from local env or Secret Manager.",
  },
  {
    label: "Resend API key",
    pattern: /\bre_[A-Za-z0-9_-]{24,}\b/g,
    explain:
      "Remove the committed Resend key and keep product email credentials server-side only.",
  },
  {
    label: "Sentry auth token",
    pattern: /\bsntrys_[A-Za-z0-9_-]{24,}\b/g,
    explain:
      "Remove the committed Sentry auth token and keep it in developer or CI secrets.",
  },
  {
    label: "Google service account private key",
    pattern: new RegExp("-----BEGIN " + "PRIVATE KEY-----", "g"),
    explain:
      "Remove the committed Google service account key file and use Secret Manager or local untracked credentials.",
  },
  {
    label: "signed URL token",
    pattern:
      /https?:\/\/[^\s"'`]+(?:X-Goog-Signature|X-Amz-Signature|token=)[^\s"'`]*/gi,
    explain:
      "Remove the committed signed URL; signed upload/download links must be short-lived runtime data.",
  },
];
const sensitiveViolations = [];

for (const file of repositoryTextFiles()) {
  if (!textFileExtensions.has(extensionOf(file))) {
    continue;
  }

  const source = read(file);
  const violation = sensitivePatterns.find(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(source);
  });

  if (violation) {
    sensitiveViolations.push(
      `${file} looks like it contains ${violation.label}. ${violation.explain}`,
    );
  }
}

addCheck(
  "repository files have no high-confidence secrets",
  sensitiveViolations.length === 0,
  sensitiveViolations.length === 0
    ? "Keep repository files free of secrets and signed URLs."
    : sensitiveViolations[0],
);

const packageJson = JSON.parse(read("package.json"));
addCheck(
  "package exposes check:harness",
  packageJson.scripts?.["check:harness"] === "node scripts/check-harness.mjs",
  "Add scripts.check:harness to package.json.",
);

const ci = read(".github/workflows/ci.yml");
for (const command of [
  "npm run check:harness",
  "npm run format:check",
  "npm run lint",
  "npm run typecheck",
  "npm run test",
  "npm run build",
  "uv run ruff check .",
  "uv run mypy .",
  "uv run pytest",
]) {
  addCheck(
    `CI runs ${command}`,
    ci.includes(command),
    "Keep CI aligned with local validation.",
  );
}

const failures = checks.filter((check) => !check.pass);

for (const check of checks) {
  const marker = check.pass ? "ok" : "fail";
  console.log(`${marker} - ${check.name}`);
  if (!check.pass) {
    console.log(`  ${check.detail}`);
  }
}

if (failures.length > 0) {
  console.error(`\nHarness check failed: ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("\nHarness check passed.");
