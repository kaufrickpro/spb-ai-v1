import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const read = (path) => readFileSync(join(root, path), "utf8");

const checks = [];

const addCheck = (name, pass, detail) => {
  checks.push({ name, pass, detail });
};

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
