const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ ROOT ROUTE (Fixes "Cannot GET /")
app.get("/", (req, res) => {
  res.send("🚨 CrisisSync AI Backend is Running!");
});

// ✅ INIT GEMINI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let incidents = [];

// 🔥 SMART AI FUNCTION (UPGRADED)
async function classifyEmergency(message) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `
You are an advanced emergency classification AI.

Analyze the message and return STRICT JSON ONLY.

Rules:
- Detect type: fire, medical, threat, accident, flood, other
- Detect severity:
   critical = life-threatening, fire, trapped, explosion, weapons
   medium = injury, risk, unstable situation
   low = minor issue
- Extract location if mentioned
- Be intelligent, not literal

Output format:
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

    // 🧹 CLEAN RESPONSE
    let cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Extract JSON safely
    let start = cleaned.indexOf("{");
    let end = cleaned.lastIndexOf("}");

    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    }

    let parsed = JSON.parse(cleaned);

    // ✅ FALLBACK LOGIC (VERY IMPORTANT)
    if (!parsed.type || parsed.type === "other") {
      const msg = message.toLowerCase();

      if (msg.includes("fire") || msg.includes("burn")) {
        parsed.type = "fire";
        parsed.severity = "critical";
      }

      if (msg.includes("accident") || msg.includes("crash")) {
        parsed.type = "accident";
        parsed.severity = "critical";
      }

      if (msg.includes("attack") || msg.includes("weapon")) {
        parsed.type = "threat";
        parsed.severity = "critical";
      }
    }

    return parsed;

  } catch (err) {
    console.log("❌ AI ERROR:", err);

    return {
      type: "other",
      location: "unknown",
      severity: "low",
      summary: message,
    };
  }
}

// 🟥 POST INCIDENT
app.post("/incident", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const aiData = await classifyEmergency(message);

    const incident = {
      id: Date.now(),
      raw_message: message,
      ...aiData,
    };

    incidents.push(incident);

    res.json(incident);

  } catch (err) {
    console.log("❌ SERVER ERROR:", err);
    res.status(500).json({ error: "Server failed" });
  }
});

// 🟩 GET INCIDENTS
app.get("/incidents", (req, res) => {
  res.json(incidents);
});

// ✅ PORT FIX (Vercel / Cloud)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
