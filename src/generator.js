import fs from "fs";

const plan = JSON.parse(fs.readFileSync("plan.json", "utf8"));

const WIDTH = Number(plan.width) || 1920;
const HEIGHT = Number(plan.height) || 1080;
const DURATION = Number(plan.duration) || 10;

const ASPECT_RATIO =
  WIDTH === HEIGHT
    ? "1:1"
    : WIDTH > HEIGHT
      ? "16:9"
      : "9:16";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeRole(element) {
  const role = String(element.role || "").toLowerCase();

  if (
    role.includes("cta") ||
    role.includes("call-to-action") ||
    role.includes("call to action")
  ) {
    return "cta";
  }

  if (
    role.includes("headline") ||
    role.includes("title") ||
    role.includes("hook")
  ) {
    return "headline";
  }

  if (
    role.includes("eyebrow") ||
    role.includes("label") ||
    role.includes("kicker")
  ) {
    return "eyebrow";
  }

  return "supporting";
}

function textClass(element) {
  return `text-element text-${normalizeRole(element)}`;
}

function sceneMarkup(scene, sceneIndex) {
  const elements = Array.isArray(scene.elements)
    ? scene.elements
    : [];

  let textIndex = 0;
  let cardIndex = 0;
  let shapeIndex = 0;

  let markup = `
    <section
      id="${escapeHtml(scene.id || `scene-${sceneIndex + 1}`)}"
      class="scene clip scene-${sceneIndex}"
      data-scene="${escapeHtml(scene.id || `scene-${sceneIndex + 1}`)}"
      data-start="${Number(scene.start) || 0}"
      data-duration="${Number(scene.duration) || 0}"
    >
      <div class="scene-content">

        <div class="scene-bg">
          <div class="grid"></div>
          <div class="glow glow-one"></div>
          <div class="glow glow-two"></div>
        </div>
  `;

  for (const element of elements) {
    const type = String(element.type || "").toLowerCase();

    if (type === "text") {
      const role = normalizeRole(element);

      markup += `
        <div
          class="${textClass(element)}"
          data-role="${escapeHtml(role)}"
          data-text-index="${textIndex}"
          data-animation="${escapeHtml(element.animation || "")}"
        >${escapeHtml(element.content || "")}</div>
      `;

      textIndex++;
      continue;
    }

    if (element.asset) {
      markup += `
        <img
          class="visual-asset"
          src="${escapeHtml(element.asset)}"
          alt="${escapeHtml(element.content || "")}"
          data-asset-index="${cardIndex}"
          data-role="${escapeHtml(element.role || type)}"
        />
      `;

      cardIndex++;
      continue;
    }

    if (type === "card" || type === "code") {
      markup += `
        <div
          class="visual-card"
          data-card-index="${cardIndex}"
          data-role="${escapeHtml(element.role || type)}"
        >
          <div class="card-title">
            ${escapeHtml(element.content || "")}
          </div>

          <div class="card-body">
            <div class="code-line long"></div>
            <div class="code-line medium"></div>
            <div class="code-line short"></div>

            <div class="status-row">
              <span>FAST</span>
              <span>STABLE</span>
              <span>SECURE</span>
            </div>

            <div class="progress-track">
              <div class="progress-fill"></div>
            </div>
          </div>
        </div>
      `;

      cardIndex++;
      continue;
    }

    if (type === "icon" || type === "diagram" || type === "image") {
      const asset = String(element.asset || "").trim();

      if (asset) {
        markup += `
          <div
            class="asset-element asset-${shapeIndex}"
            data-role="${escapeHtml(element.role || type)}"
          >
            <img
              src="${escapeHtml(asset)}"
              alt="${escapeHtml(element.content || "")}"
            />
          </div>
        `;
      }

      shapeIndex++;
      continue;
    }

    if (type === "shape") {
      markup += `
        <div
          class="decor decor-${shapeIndex}"
          data-role="${escapeHtml(element.role || "accent")}"
        ></div>
      `;

      shapeIndex++;
    }
  }

  markup += `
      </div>
    </section>
  `;

  return markup;
}

function buildTimeline(scene, index) {
  const start = Number(scene.start) || 0;
  const duration = Number(scene.duration) || 0;

  const selector = `.scene-${index}`;
  const content = `${selector} .scene-content`;

  const elements = Array.isArray(scene.elements)
    ? scene.elements
    : [];

  let code = `
    // Scene ${index + 1}

    tl.to("${content}", {
      opacity: 1,
      duration: 0.01
    }, ${start});
  `;

  let textIndex = 0;
  let cardIndex = 0;

  for (const element of elements) {
    const type = String(element.type || "").toLowerCase();

    if (type === "text") {
      const cls = `.text-element[data-text-index='${textIndex}']`;

      const offset = Math.min(
        0.8,
        textIndex * 0.12
      );

      code += `
        tl.fromTo(
          "${selector} ${cls}",
          {
            opacity: 0,
            y: 28
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: "power2.out"
          },
          ${start + offset}
        );
      `;

      textIndex++;
      continue;
    }

    if (element.asset) {
      const cls = `.visual-asset[data-asset-index='${cardIndex}']`;

      code += `
        tl.fromTo(
          "${selector} ${cls}",
          {
            opacity: 0,
            scale: 0.94
          },
          {
            opacity: 1,
            scale: 1,
            duration: 0.6,
            ease: "power2.out"
          },
          ${start + 0.2}
        );
      `;

      cardIndex++;
      continue;
    }

    if (type === "card" || type === "code") {
      const cls = `.visual-card[data-card-index='${cardIndex}']`;

      code += `
        tl.fromTo(
          "${selector} ${cls}",
          {
            opacity: 0,
            y: 35,
            scale: 0.97
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.55,
            ease: "power2.out"
          },
          ${start + 0.2}
        );

        tl.to(
          "${selector} ${cls} .progress-fill",
          {
            width: "100%",
            duration: ${Math.max(
              0.2,
              Math.min(1.2, duration - 0.4)
            )},
            ease: "power2.inOut"
          },
          ${start + 0.65}
        );
      `;

      cardIndex++;
    }
  }

  const fadeStart = Math.max(
    start,
    start + duration - 0.3
  );

  code += `
    tl.to(
      "${content}",
      {
        opacity: 0,
        duration: 0.3,
        ease: "power2.in"
      },
      ${fadeStart}
    );

    tl.set(
      "${content}",
      {
        opacity: 0
      },
      ${start + duration}
    );
  `;

  return code;
}

const sceneMarkupHtml = plan.scenes
  .map((scene, index) => sceneMarkup(scene, index))
  .join("\n");

const timelineCode = plan.scenes
  .map((scene, index) => buildTimeline(scene, index))
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  overflow: hidden;
  background: #050814;
  font-family: Inter, Arial, sans-serif;
}

#root {
  position: relative;
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 50% 45%,
      #111b3a 0%,
      #080d1e 50%,
      #03050b 100%
    );
}

.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  opacity: 1;
}

.scene-content {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scene-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.grid {
  position: absolute;
  inset: 0;
  opacity: 0.3;
  background-image:
    linear-gradient(
      rgba(60,150,255,0.08) 1px,
      transparent 1px
    ),
    linear-gradient(
      90deg,
      rgba(60,150,255,0.08) 1px,
      transparent 1px
    );
  background-size: 70px 70px;
}

.glow {
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
}

.glow-one {
  left: 5%;
  top: 5%;
  background: rgba(30,110,255,0.18);
}

.glow-two {
  right: 5%;
  bottom: 5%;
  background: rgba(110,60,255,0.15);
}

.text-element {
  position: absolute;
  height: auto;
  max-height: none;
  overflow: visible;
  white-space: normal;
  z-index: 10;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: normal;
  white-space: normal;
}

.text-eyebrow {
  left: 8%;
  top: 10%;
  width: 84%;
  max-width: 84%;
  font-size: clamp(18px, 1.5vw, 28px);
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 3px;
  color: #65c7ff;
}

.text-headline {
  left: 8%;
  top: 18%;
  width: 84%;
  max-width: 84%;
  height: auto;
  max-height: none;
  font-size: clamp(38px, 4vw, 72px);
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -1px;
  color: #ffffff;
  overflow: visible;
  white-space: normal;
}

/* Generic secondary-text positioning.
   Prevents multiple text elements with the same role
   from occupying the exact same visual zone. */
.text-element[data-text-index="1"] {
  top: 34%;
}

.text-element[data-text-index="2"] {
  top: 50%;
}

.text-element[data-text-index="3"] {
  top: 66%;
}

.text-headline[data-text-index="1"] {
  top: 32%;
  font-size: clamp(32px, 3.2vw, 60px);
}

.text-supporting {
  left: 8%;
  top: 48%;
  width: 70%;
  max-width: 70%;
  height: auto;
  max-height: none;
  font-size: clamp(20px, 1.7vw, 30px);
  line-height: 1.35;
  font-weight: 400;
  color: #aab6d0;
  overflow: visible;
  white-space: normal;
}

.text-cta {
  left: 8%;
  bottom: 9%;
  width: auto;
  max-width: 70%;
  padding: 18px 32px;
  border-radius: 14px;
  font-size: clamp(20px, 2vw, 32px);
  line-height: 1.2;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(
    135deg,
    #168cff,
    #6d4aff
  );
  box-shadow:
    0 18px 50px rgba(40,100,255,0.3);
}

.visual-asset {
  position: absolute;
  z-index: 7;
  left: 8%;
  top: 30%;
  width: 84%;
  height: 42%;
  object-fit: contain;
  object-position: center;
  border-radius: 24px;
  display: block;
}

.visual-card {
  position: absolute;
  z-index: 8;
  right: 7%;
  top: 22%;
  width: 38%;
  height: 55%;
  max-width: 680px;
  max-height: 600px;
  padding: 28px;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid rgba(130,180,255,0.24);
  background: rgba(13,20,42,0.92);
  box-shadow:
    0 30px 100px rgba(0,0,0,0.45);
}

.card-title {
  width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: clamp(18px, 1.4vw, 26px);
  line-height: 1.25;
  font-weight: 700;
  color: #d7e2ff;
}

.card-body {
  margin-top: 28px;
}

.code-line {
  height: 12px;
  margin-bottom: 16px;
  border-radius: 6px;
  background: rgba(100,190,255,0.28);
}

.code-line.long {
  width: 90%;
}

.code-line.medium {
  width: 65%;
}

.code-line.short {
  width: 42%;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 30px;
}

.status-row span {
  padding: 7px 12px;
  border-radius: 8px;
  background: rgba(72,224,164,0.1);
  color: #55e5a9;
  font-size: 12px;
  font-weight: 700;
}

.progress-track {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 28px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
}

.progress-fill {
  width: 0%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #20a5ff,
    #6c5cff
  );
}

.asset-element {
  position: absolute;
  left: 8%;
  top: 28%;
  width: 84%;
  height: 48%;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.asset-element img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 24px;
  filter: drop-shadow(0 25px 60px rgba(0,0,0,0.35));
}

.decor {
  position: absolute;
  z-index: 2;
  border: 1px solid rgba(80,180,255,0.22);
  border-radius: 50%;
  pointer-events: none;
}

.decor-0 {
  width: 220px;
  height: 220px;
  right: 8%;
  top: 10%;
}

.decor-1 {
  width: 100px;
  height: 100px;
  left: 7%;
  bottom: 8%;
}

@media (max-aspect-ratio: 1/1) {

  .text-eyebrow {
    left: 8%;
    top: 8%;
    width: 84%;
    max-width: 84%;
  }

  .text-headline {
    left: 8%;
    top: 15%;
    width: 84%;
    max-width: 84%;
    height: auto;
    max-height: none;
    overflow: visible;
    font-size: clamp(38px, 7vw, 68px);
    line-height: 1.08;
    overflow-wrap: break-word;
  }

  .text-supporting {
    left: 8%;
    top: 45%;
    width: 84%;
    max-width: 84%;
    max-height: 17%;
    font-size: clamp(19px, 3.5vw, 31px);
  }

  .text-cta {
    left: 8%;
    bottom: 7%;
    max-width: 84%;
    font-size: clamp(18px, 3.5vw, 28px);
  }

  .visual-card {
    left: 8%;
    right: auto;
    top: 64%;
    width: 84%;
    max-width: 84%;
    height: 24%;
    padding: 18px;
  }

  .decor-0 {
    width: 140px;
    height: 140px;
    right: 5%;
    top: 5%;
  }

  .decor-1 {
    width: 80px;
    height: 80px;
    left: 5%;
    bottom: 5%;
  }
}

@media (max-aspect-ratio: 1/1) and (max-height: 1400px) {

  .text-headline {
    font-size: clamp(34px, 7vw, 62px);
  }

  .text-supporting {
    font-size: clamp(18px, 3vw, 26px);
  }

}

</style>

<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>

</head>

<body>

<div
  id="root"
  data-composition-id="root"
  data-width="${WIDTH}"
  data-height="${HEIGHT}"
>

${sceneMarkupHtml}

</div>

<script>

const tl = gsap.timeline({
  paused: true
});

window.__timelines = window.__timelines || {};
window.__timelines["root"] = tl;

${timelineCode}

window.HF_READY = true;

window.HF_GET_DURATION = () => {
  return ${DURATION};
};

</script>

</body>
</html>`;

fs.writeFileSync("index.html", html);

console.log("Composition generated: index.html");
console.log(
  `Duration: ${DURATION}s | ${WIDTH}x${HEIGHT} | ${ASPECT_RATIO}`
);
