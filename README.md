# Infinall AI — AI Text-to-Video Pipeline

An end-to-end AI video generation pipeline that converts a plain-language video brief into a structured plan, generates the required visual assets, builds a HyperFrames composition, verifies it, repairs it if needed, and renders a final MP4.

The goal is a complete text-to-video workflow where the user only needs to provide a natural-language brief.

---

## Pipeline

```text
Plain-language video brief
        ↓
     GPT-5.5
        ↓
    plan.json
        ↓
   GPT-Image-2
        ↓
  Generated assets
        ↓
HyperFrames composition
        ↓
  Verification gate
        ↓
  Repair if needed
        ↓
 HyperFrames render
        ↓
 renders/final.mp4
```

The pipeline is orchestrated automatically by `src/pipeline.js`.

---

## Features

- Plain-language text-to-video input from the terminal
- GPT-5.5-powered structured video planning
- Persistent `plan.json` planning artifact
- GPT-Image-2 visual asset generation
- Programmatic HyperFrames composition generation
- HyperFrames verification gate
- Automatic GPT-5.5 repair loop when verification fails
- Up to 3 automatic repair attempts
- Automatic HyperFrames MP4 rendering
- Final output written to `renders/final.mp4`
- Intermediate plans, assets, and verification results stored as inspectable artifacts

---

## Requirements

Before running the project, make sure the following are installed:

- Node.js
- npm
- Git
- An OpenAI-compatible API key with access to the models used by the project

HyperFrames is executed through `npx`, so a global HyperFrames installation is not required.

---

## Installation

Clone the repository:

```bash
git clone git@github.com:architha35/infinall_ai.git
```

Enter the project directory:

```bash
cd infinall_ai
```

Install the Node.js dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Add the API key:

```env
OPENAI_API_KEY=your_api_key_here
```

The API key is loaded through the environment and is not hard-coded into the source code.

**Do not commit `.env` to Git.**

---

## Running the Complete Pipeline

The main entry point is:

```bash
node src/pipeline.js "YOUR VIDEO BRIEF"
```

For example:

```bash
node src/pipeline.js "Create a 10 second vertical video explaining why drinking water is important. Make it clean, modern, and energetic."
```

The pipeline automatically performs the entire workflow.

---

## How the Pipeline Works

### 1. Plain-Language Brief

The user provides a natural-language description of the video.

Example:

```text
Create a 12 second vertical video explaining why drinking water is important.
Make it clean, modern, and energetic.
```

No manual scene construction is required from the user.

### 2. GPT-5.5 Planning

The brief is passed to GPT-5.5 by `src/planner.js`.

GPT-5.5 converts the brief into a structured planning artifact. The plan describes the intended video, including information such as:

- Video duration
- Aspect ratio
- Scene count
- Scene timing
- Scene content
- Text content
- Visual direction
- Motion intent
- Required visual elements

The resulting plan is written to:

```text
plan.json
```

This makes the planning stage an explicit and inspectable artifact rather than a hidden prompt chain.

### 3. GPT-Image-2 Asset Generation

The pipeline examines the structured plan for elements that require generated imagery.

`src/assets.js` uses GPT-Image-2 to generate the required visual assets.

Generated assets are saved under:

```text
assets/
```

The generated asset paths are also associated with their corresponding elements in `plan.json`.

If an identical asset already exists, the pipeline can reuse it instead of unnecessarily generating it again.

### 4. HyperFrames Composition Generation

`src/generator.js` reads the structured `plan.json` and generates the HyperFrames composition.

The generated composition is written to:

```text
index.html
```

This composition contains the visual structure required by the plan, including elements such as:

- Text
- Shapes
- Cards
- Icons
- Generated imagery
- Layout
- Timing
- Motion

HyperFrames is responsible for turning this composition into the actual video frames during rendering.

### 5. HyperFrames Verification Gate

Before the final video is produced, the pipeline runs the HyperFrames verification gate.

The equivalent HyperFrames command is:

```bash
npx --yes hyperframes@0.8.27 check . --json
```

The verification checks the generated composition for issues across areas including:

- Lint
- Runtime
- Layout
- Motion
- Contrast

Verification results are saved under:

```text
verification/
```

For example:

```text
verification/check-1.json
```

The pipeline only proceeds to rendering when the verification gate passes.

### 6. Automatic Self-Repair

If the verification gate fails, the pipeline does not simply ignore the errors.

The detected verification findings are collected by `src/pipeline.js`. Those issues are passed to GPT-5.5 through the repair workflow. GPT-5.5 generates concrete repair instructions, which are saved to:

```text
repair.json
```

The composition is then regenerated and verified again. The pipeline allows up to 3 repair attempts.

The workflow is therefore:

```text
Verification fails
        ↓
   Collect issues
        ↓
GPT-5.5 analyzes issues
        ↓
Generate repair instructions
        ↓
Regenerate composition
        ↓
Run HyperFrames verification again
```

If verification continues to fail after the maximum number of repair attempts, the pipeline stops instead of falsely declaring success.

### 7. HyperFrames MP4 Rendering

Once the HyperFrames verification gate passes, the pipeline automatically calls HyperFrames to render the composition.

The rendering command used by the pipeline is equivalent to:

```bash
npx --yes hyperframes@0.8.27 render . --output renders/final.mp4
```

The final video is written to:

```text
renders/final.mp4
```

A successful run ends with a message similar to:

```text
🎉 End-to-end pipeline complete.
🎬 Video: renders/final.mp4
```

The resulting file is the actual rendered MP4 generated from the HyperFrames composition.

---

## Example End-to-End Run

Run:

```bash
node src/pipeline.js "Create a 10 second vertical video explaining why drinking water is important. Make it clean, modern, and energetic."
```

The system performs:

```text
🧠 Generate planning artifact
        ↓
🖼️ Generate visual assets
        ↓
🎞️ Generate HyperFrames composition
        ↓
🔍 Run verification
        ↓
🔧 Repair if verification fails
        ↓
🎥 Render final MP4
```

The final output is:

```text
renders/final.mp4
```

---

## Project Structure

```text
## Project Structure

```text
infinall_ai/
├── src/
│   ├── pipeline.js
│   ├── planner.js
│   ├── assets.js
│   └── generator.js
├── assets/
│   └── Generated visual assets
├── verification/
│   └── HyperFrames verification results
├── renders/
│   └── Rendered MP4 output
├── submission/
│   ├── brief-1-water/
│   │   ├── brief.txt
│   │   ├── check.json
│   │   └── final.mp4
│   ├── brief-2-coding/
│   │   ├── brief.txt
│   │   ├── check.json
│   │   └── final.mp4
│   └── brief-3-productivity/
│       ├── brief.txt
│       ├── check.json
│       └── final.mp4
├── plan.json
├── hyperframes.json
├── meta.json
├── index.html
├── package.json
├── package-lock.json
└── .gitignore
```

> Note: the project-structure tree above is a best-effort reconstruction — the source screenshot cut off before showing the full file list, so double-check this section against your actual repo before publishing.
