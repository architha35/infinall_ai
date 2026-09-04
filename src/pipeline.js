import fs from "fs";
import { execFileSync } from "child_process";
import OpenAI from "openai";
import "dotenv/config";

const MAX_REPAIR_ATTEMPTS = 3;
const PLAN_FILE = "plan.json";
const GENERATOR = "src/generator.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://llm.ganeshnayak.in/v1",
});

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function generatePlan(brief) {
  if (!brief) return;

  console.log("\n🧠 Generating planning artifact from brief...");
  run("node", ["src/planner.js", brief]);
}

function generateAssets() {
  console.log("\n🖼️ Generating visual assets with GPT-Image-2...");
  run("node", ["src/assets.js"]);
}

function generateComposition() {
  console.log("\n🎬 Generating composition from plan...");
  run("node", [GENERATOR]);
}

function renderVideo() {

  console.log("\n🎥 Rendering final video...\n");

  run("npx", [

    "--yes",

    "hyperframes@0.8.27",

    "render",

    ".",

    "--output",

    "renders/final.mp4"

  ]);

  console.log("✅ Final video rendered: renders/final.mp4");

}

function runHyperFramesCheck() {
  console.log("\n🔍 Running HyperFrames verification gate...\n");

  try {
    const output = run("npx", [
      "--yes",
      "hyperframes@0.8.27",
      "check",
      ".",
      "--json",
    ]);

    return JSON.parse(output);
  } catch (error) {
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {}
    }

    console.error(error.stderr || error.message);
    throw new Error("Verification gate could not be executed.");
  }
}

function renderComposition() {
  console.log("\n🎥 Verification passed. Rendering final MP4...\n");

  fs.mkdirSync("renders", { recursive: true });

  run("npx", [
    "--yes",
    "hyperframes@0.8.27",
    "render",
    ".",
    "-o",
    "renders/final.mp4",
    "--format",
    "mp4",
    "--strict",
  ]);

  if (!fs.existsSync("renders/final.mp4")) {
    throw new Error("Render completed but renders/final.mp4 was not created.");
  }

  console.log("\n✅ Final video rendered: renders/final.mp4");
}

function collectIssues(result) {
  const issues = [];

  for (const [sectionName, section] of Object.entries({
    lint: result.lint,
    runtime: result.runtime,
    layout: result.layout,
    motion: result.motion,
    contrast: result.contrast,
  })) {
    if (!section?.findings) continue;

    for (const finding of section.findings) {
      issues.push({
        section: sectionName,
        code: finding.code,
        severity: finding.severity,
        message: finding.message,
        selector: finding.selector,
        time: finding.time,
        dataAttributes: finding.dataAttributes,
      });
    }
  }

  return issues;
}

function printIssues(issues) {
  console.log("\n❌ Verification failed.\n");

  for (const issue of issues) {
    console.log(
      `[${issue.section}] ${issue.severity || "error"}: ${
        issue.code || "unknown"
      }`
    );

    if (issue.message) {
      console.log(`  ${issue.message}`);
    }

    if (issue.selector) {
      console.log(`  selector: ${issue.selector}`);
    }

    if (issue.time !== undefined) {
      console.log(`  time: ${issue.time}s`);
    }

    console.log();
  }
}

function validatePlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Repair model returned a non-object plan.");
  }

  if (
    typeof plan.title !== "string" ||
    !Number.isFinite(Number(plan.duration)) ||
    Number(plan.duration) <= 0 ||
    !Array.isArray(plan.scenes) ||
    plan.scenes.length === 0
  ) {
    throw new Error("Repair model returned an invalid plan structure.");
  }

  const duration = Number(plan.duration);

  let previousEnd = 0;

  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];

    if (
      typeof scene.id !== "string" ||
      !Number.isFinite(Number(scene.start)) ||
      !Number.isFinite(Number(scene.duration)) ||
      Number(scene.duration) <= 0 ||
      !Array.isArray(scene.elements)
    ) {
      throw new Error(`Invalid scene structure at scene ${i + 1}.`);
    }

    const start = Number(scene.start);
    const sceneDuration = Number(scene.duration);
    const end = start + sceneDuration;

    if (Math.abs(start - previousEnd) > 0.001) {
      throw new Error(
        `Scene timings are not contiguous at scene ${i + 1}.`
      );
    }

    if (end > duration + 0.001) {
      throw new Error(
        `Scene ${i + 1} extends beyond total duration.`
      );
    }

    previousEnd = end;
  }

  if (Math.abs(previousEnd - duration) > 0.001) {
    throw new Error(
      `Scene timings do not add up to total duration.`
    );
  }

  return true;
}

function extractJson(text) {
  let cleaned = String(text || "").trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return JSON.parse(cleaned);
}

async function repairPlan(issues, attempt) {
  const currentPlan = JSON.parse(
    fs.readFileSync(PLAN_FILE, "utf8")
  );

  const existingRepair = fs.existsSync("repair.json")
    ? JSON.parse(fs.readFileSync("repair.json", "utf8"))
    : { layout: {}, css: "" };

  console.log(
    `\n�� Asking GPT-5.5 to repair the composition (${attempt}/${MAX_REPAIR_ATTEMPTS})...`
  );

  const response = await client.chat.completions.create({
    model: "gpt-5.5",
    messages: [
      {
        role: "system",
        content: `
You are the self-repair controller for a HyperFrames video generator.

HyperFrames has inspected the generated composition and found issues.

Your job is NOT to redesign the video.
Your job is to produce concrete repair instructions that change the
generated composition enough to resolve the reported issues.

Return ONLY valid JSON with exactly this shape:

{
  "layout": {},
  "css": "string"
}

The "css" field contains CSS overrides that will be inserted into the
generated HyperFrames composition.

Important:
- Repair the actual reported problem.
- Prefer targeted CSS fixes when the issue is layout/overlap.
- Use the ACTUAL generated scene selectors.
- Scenes are zero-indexed in the generated HTML:
  first scene = .scene-0
  second scene = .scene-1
  third scene = .scene-2
  fourth scene = .scene-3
- Therefore, never assume the human scene number equals the CSS selector.
- Use scene-specific selectors such as .scene-2 .headline only when the
  reported issue actually belongs to the third scene.
- Do not rely on changing animation descriptions.
- Do not use JavaScript.
- Do not use external libraries.
- Do not remove required content.
- Keep the composition visually coherent.
- Keep the existing creative direction.
- CSS must be valid.
- The repair must be deterministic.

For content_overlap:
- Move conflicting elements apart.
- Reduce max-width/font-size if necessary.
- Use scene-specific selectors.
- Ensure text and cards have sufficient separation.

For contrast:
- Change text/background contrast using CSS.

For motion:
- Do not create extreme movement or excessive animation.

For lint:
- Only address the reported lint issue if it is actionable.
        `,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            current_plan: currentPlan,
            existing_repair: existingRepair,
            verification_issues: issues,
          },
          null,
          2
        ),
      },
    ],
    max_tokens: 4000,
  });

  const content =
    response.choices[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("GPT-5.5 returned no repair instructions.");
  }

  let repaired;

  try {
    repaired = extractJson(content);
  } catch {
    throw new Error(
      "GPT-5.5 returned unusable repair JSON."
    );
  }

  if (
    !repaired ||
    typeof repaired !== "object" ||
    typeof repaired.css !== "string"
  ) {
    throw new Error(
      "GPT-5.5 returned an invalid repair structure."
    );
  }

  fs.writeFileSync(
    "repair.json",
    JSON.stringify(repaired, null, 2)
  );

  console.log("✅ Concrete repair instructions written to repair.json.");
}

async function main() {
  fs.mkdirSync("verification", { recursive: true });

  const brief = process.argv.slice(2).join(" ").trim();

  /*
   * If a brief is supplied, create a fresh planning artifact first.
   * Otherwise preserve the existing plan.json workflow.
   */
  generatePlan(brief);
  generateAssets();
  generateComposition();

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    console.log(
      `\n========== VERIFICATION ATTEMPT ${attempt + 1} ==========\n`
    );

    const result = runHyperFramesCheck();

    fs.writeFileSync(
      `verification/check-${attempt + 1}.json`,
      JSON.stringify(result, null, 2)
    );

    if (result.ok === true) {



      console.log("\\n✅ HyperFrames gate PASSED.\\n");



      console.log("Verification complete.");



      renderVideo();



      console.log("\\n🎉 End-to-end pipeline complete.");



      console.log("🎥 Video: renders/final.mp4");



      return;



    }

    const issues = collectIssues(result);
    printIssues(issues);

    if (attempt === MAX_REPAIR_ATTEMPTS) {
      console.error(
        `\n💥 Verification failed after ${MAX_REPAIR_ATTEMPTS} repair attempts.`
      );
      console.error(
        "The generator refuses to produce a final video."
      );
      process.exit(1);
    }

    try {
      await repairPlan(issues, attempt + 1);
      generateComposition();
    } catch (error) {
      console.error("\n💥 Repair failed.");
      console.error(error.message);
      console.error(
        "The generator refuses to silently continue with an invalid composition."
      );
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error("\n💥 Pipeline failed.");
  console.error(error);
  process.exit(1);
});
