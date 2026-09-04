import OpenAI from "openai";
import "dotenv/config";
import fs from "fs";
import path from "path";

const PLAN_FILE = "plan.json";
const ASSET_DIR = "assets";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://llm.ganeshnayak.in/v1",
});

const plan = JSON.parse(
  fs.readFileSync(PLAN_FILE, "utf8")
);

fs.mkdirSync(ASSET_DIR, { recursive: true });

function safeName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function needsImage(element) {
  const type = String(element?.type || "").toLowerCase();

  return [
    "image",
    "icon",
    "diagram",
    "illustration",
    "photo",
    "visual",
  ].includes(type);
}

function buildAssetPrompt(scene, element) {
  const visualDescription =
    element.content ||
    element.description ||
    scene.visual_direction ||
    "";

  return `
Create a production-ready visual asset for a generated video.

Visual requirement:
${visualDescription}

Overall scene direction:
${scene.visual_direction || ""}

Video aspect ratio:
${plan.aspect_ratio || "16:9"}

Style:
- polished
- modern
- visually clear
- coherent with the scene direction
- suitable for compositing into a motion-graphics video
- clean edges
- no unnecessary text
- no logos or watermarks

The asset should communicate the requested visual concept clearly.
Do not add explanatory text unless the visual requirement explicitly
requires text.
`;
}

async function generateImage(prompt) {
  const response = await client.images.generate({
    model: "gpt-image-2",
    prompt,
    size:
      plan.aspect_ratio === "9:16"
        ? "1024x1536"
        : plan.aspect_ratio === "1:1"
          ? "1024x1024"
          : "1536x1024",
  });

  const image = response.data?.[0];

  if (!image) {
    throw new Error("GPT-Image-2 returned no image.");
  }

  if (image.b64_json) {
    return Buffer.from(image.b64_json, "base64");
  }

  if (image.url) {
    const imageResponse = await fetch(image.url);

    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download generated image: ${imageResponse.status}`
      );
    }

    return Buffer.from(
      await imageResponse.arrayBuffer()
    );
  }

  throw new Error(
    "GPT-Image-2 returned neither b64_json nor url."
  );
}

async function main() {
  console.log("\n🖼️ Generating visual assets...\n");

  let generatedCount = 0;

  for (let sceneIndex = 0; sceneIndex < plan.scenes.length; sceneIndex++) {
    const scene = plan.scenes[sceneIndex];

    if (!Array.isArray(scene.elements)) {
      continue;
    }

    for (
      let elementIndex = 0;
      elementIndex < scene.elements.length;
      elementIndex++
    ) {
      const element = scene.elements[elementIndex];

      if (!needsImage(element)) {
        continue;
      }

      const description =
        element.content ||
        element.description ||
        `visual asset for scene ${sceneIndex + 1}`;

      const filename =
        `scene-${sceneIndex + 1}-` +
        `${elementIndex + 1}-` +
        `${safeName(description) || "visual"}.png`;

      const outputPath = path.join(
        ASSET_DIR,
        filename
      );

      console.log(
        `🎨 Scene ${sceneIndex + 1}, element ${elementIndex + 1}`
      );
      console.log(`   ${description}`);

      /*
       * Deterministic file handling:
       * if this exact asset already exists, reuse it.
       */
      if (fs.existsSync(outputPath)) {
        console.log(`   ♻️ Reusing ${outputPath}\n`);

        element.asset = outputPath;
        continue;
      }

      const prompt = buildAssetPrompt(
        scene,
        element
      );

      console.log("   🤖 Asking GPT-Image-2...");

      const imageBuffer =
        await generateImage(prompt);

      fs.writeFileSync(
        outputPath,
        imageBuffer
      );

      element.asset = outputPath;

      generatedCount++;

      console.log(
        `   ✅ Saved ${outputPath}\n`
      );
    }
  }

  /*
   * Preserve the planner's asset array while also
   * recording generated assets.
   */
  const generatedAssets = [];

  for (const scene of plan.scenes) {
    for (const element of scene.elements || []) {
      if (element.asset) {
        generatedAssets.push({
          path: element.asset,
          scene: scene.id,
          type: element.type,
          content: element.content || "",
        });
      }
    }
  }

  plan.assets = generatedAssets;

  fs.writeFileSync(
    PLAN_FILE,
    JSON.stringify(plan, null, 2)
  );

  console.log(
    `\n✅ Asset generation complete.`
  );

  console.log(
    `Generated: ${generatedCount}`
  );

  console.log(
    `Total assets: ${generatedAssets.length}`
  );

  console.log(
    `Updated: ${PLAN_FILE}\n`
  );
}

main().catch((error) => {
  console.error("\n💥 Asset generation failed.");
  console.error(error.message);
  process.exit(1);
});
