// ============================================================
//  Sima's Baking — WhatsApp × Claude Bot
//  Features: multi-turn memory, Hebrew/English detection,
//            custom brand system prompt, graceful error handling
// ============================================================

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// ── Config ──────────────────────────────────────────────────
const {
  ANTHROPIC_API_KEY,
  WHATSAPP_TOKEN,
  WA_PHONE_NUMBER_ID,
  VERIFY_TOKEN,
  PORT = 3000,
} = process.env;

// ── In-Memory Conversation Store ────────────────────────────
// Stores last N messages per user phone number
// Format: { "972501234567": [ { role, content }, ... ] }
const conversations = new Map();
const MAX_HISTORY = 10; // keep last 10 turns per user

function getHistory(phone) {
  if (!conversations.has(phone)) conversations.set(phone, []);
  return conversations.get(phone);
}

function addToHistory(phone, role, content) {
  const history = getHistory(phone);
  history.push({ role, content });
  // Trim to last MAX_HISTORY messages
  if (history.length > MAX_HISTORY) {
    conversations.set(phone, history.slice(-MAX_HISTORY));
  }
}

// ── Language Detection ───────────────────────────────────────
// Detects if text contains Hebrew characters (Unicode range)
function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

function getLanguageInstruction(text) {
  return isHebrew(text)
    ? "The user is writing in Hebrew. Reply in Hebrew only."
    : "The user is writing in English. Reply in English only.";
}

// ── System Prompt ────────────────────────────────────────────
// Brand-aware prompt for Sima's Baking WhatsApp assistant
function buildSystemPrompt(userMessage) {
  const langInstruction = getLanguageInstruction(userMessage);

  return `You are the friendly, warm WhatsApp assistant for Sima's Baking — a luxury boutique cake business in Boca Raton, Florida run by Sima.

YOUR ROLE:
- Help customers with inquiries about cakes, pricing, flavors, ordering, and availability.
- Represent the brand with warmth, confidence, and a touch of elegance.
- Never sound robotic or overly formal. Be personable and helpful.

BRAND VOICE:
- Warm, feminine, confident, luxurious. Never cutesy or apologetic.
- Use emojis tastefully: ✨ 🤍 🎂 👑
- Short, clean sentences beat long flowery ones.
- Lead with feeling, then with detail.

BUSINESS FACTS (use these when answering questions):
- Business name: Sima's Baking
- Location: Boca Raton, FL
- Website: www.simasbaking.com
- Ordering: WhatsApp only
- Lead time: Minimum 2 weeks in advance
- Rush orders: Available for a $50 rush fee
- Payment: Full payment required upfront. For orders $1,000+, a deposit may apply.
- Specialties: Custom buttercream cakes, cupcakes, dessert boxes, cookies
- Never uses fondant — only Swiss meringue buttercream
- Ingredients: Non-GMO, kosher style, dairy-free / gluten-free / vegan options available
- Decorations: Handcrafted from premium chocolate and sugar paper
- Custom edible images available upon request
- All orders are beautifully packaged

PRICING GUIDANCE (general — always say final pricing is given after reviewing details):
- Cakes start at $150 and go up based on size, design complexity, and tiers
- Sheet cakes are a great budget-friendly option for larger groups
- Encourage customers to share their vision and Sima will provide a custom quote

WHAT TO DO:
- If they ask to place an order → collect: event date, number of guests, theme/flavors, any dietary needs, and let them know Sima will confirm
- If they ask about availability → explain 2-week minimum and ask for their event date
- If they ask about price → give a general range and offer to get them a proper quote
- If they have a complaint or issue → be empathetic, assure them Sima will personally look into it, and ask them to share details
- If a question is outside your knowledge → say "Let me pass this to Sima directly — she'll get back to you shortly! 🤍"

LANGUAGE INSTRUCTION:
${langInstruction}

IMPORTANT:
- Keep replies concise — WhatsApp messages should be short and conversational.
- Never make up prices or promise availability. When in doubt, say Sima will confirm.
- Always end with a warm, action-oriented close.`;
}

// ── Claude API Call ──────────────────────────────────────────
async function askClaude(phone, userMessage) {
  // Add user's message to history
  addToHistory(phone, "user", userMessage);

  const history = getHistory(phone);
  const systemPrompt = buildSystemPrompt(userMessage);

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemPrompt,
      messages: history,
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    }
  );

  const reply = response.data.content[0].text;

  // Add Claude's reply to history
  addToHistory(phone, "assistant", reply);

  return reply;
}

// ── Send WhatsApp Message ────────────────────────────────────
async function sendWhatsAppMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text, preview_url: false },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ── Send Typing Indicator (optional UX touch) ────────────────
async function sendTypingStatus(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "reaction",
        reaction: { message_id: "", emoji: "" }, // placeholder
      },
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      }
    );
  } catch {
    // Typing indicator is optional — silently ignore if it fails
  }
}

// ── Mark Message as Read ─────────────────────────────────────
async function markAsRead(messageId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      }
    );
  } catch {
    // Non-critical — ignore
  }
}

// ── Webhook Verification ─────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    console.warn("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ── Main Webhook Handler ─────────────────────────────────────
app.post("/webhook", async (req, res) => {
  // Always reply 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // Ignore status updates (delivered, read, etc.)
    if (value?.statuses) return;

    const message = value?.messages?.[0];
    if (!message) return;

    const phone = message.from;
    const messageId = message.id;

    // Only handle text messages for now
    if (message.type !== "text") {
      await sendWhatsAppMessage(
        phone,
        "Hi! 👋 I can only read text messages right now. For photos or voice notes, please contact Sima directly. 🤍"
      );
      return;
    }

    const userText = message.text.body.trim();
    console.log(`📩 Message from ${phone}: ${userText}`);

    // Mark as read
    await markAsRead(messageId);

    // Get Claude's reply
    const reply = await askClaude(phone, userText);
    console.log(`🤖 Claude reply to ${phone}: ${reply}`);

    // Send reply back
    await sendWhatsAppMessage(phone, reply);
  } catch (err) {
    console.error("❌ Error processing message:", err?.response?.data || err.message);
  }
});

// ── Health Check ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "✅ Sima's Baking WhatsApp Bot is running 🎂" });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🎂 Sima's Baking WhatsApp Bot running on port ${PORT}`);
});
