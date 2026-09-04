import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://llm.ganeshnayak.in/v1",
});

const response = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [
    {
      role: "user",
      content: "Reply with exactly: API TEST SUCCESS",
    },
  ],
  max_tokens: 300,
});

console.log(response.choices[0].message.content);