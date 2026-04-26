const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let incidents = [];

// 🔎 SIMPLE LOCATION EXTRACTOR
function extractLocation(message) {
  const words = message.split(" ");
  return words.slice(-3).join(" ");
}

// 🔥 HYBRID AI + RULE SYSTEM (VERY IMPORTANT)
async function classifyEmergency(message) {
  const msg = message.toLowerCase();

  // 🚨 RULE-BASED (NEVER FAIL)
  if (msg.includes("fire") || msg.includes("burn") || msg.includes("smoke")) {
    return {
      type: "fire",
      location: extractLocation(message),
      severity: msg.includes("trapped") ? "critical" : "medium",
      summary: "Fire emergency detected"
    };
  }

  if (msg.includes("not breathing") || msg.includes("unconscious")) {
    return {
      type: "medical",
      location: extractLocation(message),
      severity: "critical",
      summary: "Critical medical emergency"
    };
  }

  if (msg.includes("gun") || msg.includes("weapon") || msg.includes("attack")) {
    return {
      type: "threat",
      location: extractLocation(message),
      severity: "critical",
      summary: "Security threat detected"
    };
  }

  // 🧠 GEMINI FALLBACK (SMART CASES)
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Classify emergency.

Return ONLY JSON:
{
"type": "",
"location": "",
"severity": "",
"summary": ""
}

Message: "${message}"
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    let cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let start = cleaned.indexOf("{");
    let end = cleaned.lastIndexOf("}");

    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    }

    return JSON.parse(cleaned);

  } catch (err) {
    console.log("AI ERROR:", err);

    return {
      type: "other",
      location: "unknown",
      severity: "low",
      summary: message
    };
  }
}

// 🟥 POST
app.post("/incident", async (req, res) => {
  const { message } = req.body;

  const aiData = await classifyEmergency(message);

  const incident = {
    id: Date.now(),
    raw_message: message,
    ...aiData
  };

  incidents.push(incident);
  res.json(incident);
});

// 🟩 GET
app.get("/incidents", (req, res) => {
  res.json(incidents);
});

// 🚀 START
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});