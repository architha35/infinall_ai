import OpenAI from "openai";
import "dotenv/config";
import fs from "fs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://llm.ganeshnayak.in/v1",
});

// Accept the video brief from the command line.
// Example:
// node src/planner.js "A 12 second ad for a developer tool..."
const brief = process.argv.slice(2).join(" ").trim();

if (!brief) {
  console.error(
    'Usage: node src/planner.js "your plain-language video brief"'
  );
  process.exit(1);
}

console.log("\n🎬 Creating video plan from brief...\n");
console.log(`Brief: ${brief}\n`);

const response = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [
    {
      role: "system",
      content: `
You are a video planning agent.

Convert the user's plain-language video brief into a structured JSON
planning artifact that another program can use to generate a HyperFrames
composition.

Return ONLY valid JSON.
Do not return markdown.
Do not return explanations.

The JSON must have this structure:

{
  "title": "string",
  "duration": 10,
  "width": 1920,
  "height": 1080,
  "aspect_ratio": "16:9",
  "scenes": [
    {
      "id": "scene-1",
      "start": 0,
      "duration": 3,
      "purpose": "string",
      "elements": [
        {
          "type": "text",
          "content": "string",
          "role": "eyebrow",
          "animation": "string"
        }
      ],
      "visual_direction": "string"
    }
  ],
  "assets": []
}

Rules:

- Follow the user's requested duration when one is provided.
- Infer a sensible duration only when the user does not provide one.
- Infer the requested aspect ratio.
- Use 1920x1080 for 16:9.
- Use 1080x1920 for 9:16.
- Use 1080x1080 for 1:1.
- The scene timings must cover the complete duration without gaps or
  overlaps.
- Scene count should depend on the brief. Do not force every brief into
  the same number of scenes.
- Text amount and element types should depend on the brief.
- Describe motion clearly enough for a composition generator to implement.
- Put required visual assets in the assets array.
- Do not invent external assets when CSS/HTML elements are sufficient.
`,
    },
    {
      role: "user",
      content: brief,
    },
  ],
  max_tokens: 4000,
});

const content = response.choices[0]?.message?.content?.trim();

if (!content) {
  console.error("GPT-5.5 returned no content.");
  console.error(JSON.stringify(response, null, 2));
  process.exit(1);
}

let plan;

try {
  plan = JSON.parse(content);
} catch (error) {
  console.error("GPT-5.5 returned invalid JSON:");
  console.error(content);
  process.exit(1);
}

// Basic validation before accepting the planning artifact.
if (
  typeof plan.title !== "string" ||
  typeof plan.duration !== "number" ||
  typeof plan.width !== "number" ||
  typeof plan.height !== "number" ||
  !Array.isArray(plan.scenes) ||
  !Array.isArray(plan.assets)
) {
  console.error("GPT-5.5 returned an unusable planning artifact.");
  console.error(JSON.stringify(plan, null, 2));
  process.exit(1);
}

const totalSceneDuration = plan.scenes.reduce(
  (sum, scene) => sum + Number(scene.duration || 0),
  0
);

if (Math.abs(totalSceneDuration - plan.duration) > 0.01) {
  console.error(
    `Invalid plan: scene durations total ${totalSceneDuration}s, ` +
      `but duration is ${plan.duration}s.`
  );
  process.exit(1);
}

fs.writeFileSync(
  "plan.json",
  JSON.stringify(plan, null, 2)
);

console.log("✅ Planning artifact created: plan.json");
console.log(
  `Scenes: ${plan.scenes.length} | ` +
  `Duration: ${plan.duration}s | ` +
  `Size: ${plan.width}x${plan.height}`
);