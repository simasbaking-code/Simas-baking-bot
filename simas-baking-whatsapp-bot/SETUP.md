# 🎂 Sima's Baking — WhatsApp AI Bot
## Full Setup & Deployment Guide

---

## What This Bot Does

✅ Answers customer WhatsApp inquiries automatically (in your brand voice)  
✅ Remembers the conversation context (multi-turn memory)  
✅ Detects Hebrew vs English and replies in the right language  
✅ Knows your menu, pricing guidance, policies, and ordering flow  
✅ Marks messages as "read" so customers see the blue ticks  
✅ Hands off gracefully when it doesn't know the answer  

---

## Prerequisites

Before you start, you need:

| What | Where to get it |
|---|---|
| Node.js 18+ installed | https://nodejs.org |
| A Meta Developer account | https://developers.facebook.com |
| An Anthropic API key | https://console.anthropic.com |
| A WhatsApp Business number | (your existing number or a new one) |
| A public HTTPS server | Railway, Render, or Heroku (free tiers work) |

---

## Step 1 — Set Up Meta / WhatsApp Business API

1. Go to **https://developers.facebook.com**
2. Click **My Apps → Create App**
3. Choose **Business** as app type
4. Name it `Simas Baking Bot`
5. In your app dashboard → click **Add Product** → choose **WhatsApp**
6. Go to **WhatsApp → API Setup**
7. Note down:
   - **Phone Number ID** → this is your `WA_PHONE_NUMBER_ID`
   - **Temporary Access Token** → this is your `WHATSAPP_TOKEN`
     *(for production, create a permanent System User token via Business Manager)*

---

## Step 2 — Deploy to Railway (Easiest Option)

> Railway gives you a free public HTTPS URL — exactly what Meta requires for webhooks.

1. Go to **https://railway.app** and sign up with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Upload this folder to a new GitHub repository first:
   ```
   git init
   git add .
   git commit -m "Simas baking bot"
   git remote add origin https://github.com/YOUR_USERNAME/simas-bot.git
   git push -u origin main
   ```
4. Back in Railway → select your repo → it auto-detects Node.js ✅
5. Go to **Variables** tab and add:
   ```
   ANTHROPIC_API_KEY = sk-ant-your-key
   WHATSAPP_TOKEN   = EAAxxxxx
   WA_PHONE_NUMBER_ID = 123456789
   VERIFY_TOKEN     = simasbaking_secret_2025
   PORT             = 3000
   ```
6. Click **Deploy** — Railway gives you a URL like `https://simas-bot.up.railway.app`

---

## Step 3 — Register the Webhook with Meta

1. Go back to **Meta Developer Console → WhatsApp → Configuration**
2. Click **Edit** next to Webhook
3. Set:
   - **Callback URL:** `https://simas-bot.up.railway.app/webhook`
   - **Verify Token:** `simasbaking_secret_2025` *(must match your .env)*
4. Click **Verify and Save** — if it shows ✅, it worked!
5. Under **Webhook fields**, subscribe to **messages**

---

## Step 4 — Test It!

Send a WhatsApp message to your business number.

**Try these test messages:**
- `"Hi! I need a birthday cake for 30 people"`
- `"How much does a 3-tier cake cost?"`
- `"Do you have gluten-free options?"`
- `"שלום, אני צריכה עוגה ליום הולדת"` (Hebrew — bot will reply in Hebrew!)

You should get a reply within 2–3 seconds. 🎉

---

## Step 5 — Go Live (Permanent Token)

The temporary token from Meta expires in 24 hours. For production:

1. Go to **Meta Business Suite → Settings → Users → System Users**
2. Create a new System User
3. Assign your WhatsApp app with `whatsapp_business_messaging` permission
4. Generate a **permanent access token**
5. Replace `WHATSAPP_TOKEN` in Railway with this permanent token

---

## Conversation Memory — How It Works

Each customer's phone number has its own conversation history stored in memory.

- Keeps the **last 10 messages** per customer
- Resets when the server restarts (for persistent memory, you'd need a database like Redis or Supabase — ask Sima's bot builder to add this!)

---

## Customizing the Bot

All customization lives in `src/server.js`:

| What to change | Where in the file |
|---|---|
| Bot personality / brand voice | `buildSystemPrompt()` function |
| Business hours / pricing | Inside the system prompt text |
| Conversation memory length | `MAX_HISTORY` constant (line ~20) |
| Languages | `isHebrew()` function — add more if needed |
| Reply length | `max_tokens` in the Claude API call |

---

## Adding New Features (Future Ideas)

| Feature | Complexity |
|---|---|
| Remember customer name across sessions | Medium — needs database |
| Send cake photos when customer asks | Medium — use WhatsApp media API |
| Auto-notify Sima of new order requests | Easy — add email/SMS on order keywords |
| Booking calendar integration | Advanced |
| Spanish language support | Easy — add `isSpanish()` function |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Webhook verification fails | Check VERIFY_TOKEN matches exactly |
| Messages not arriving | Check webhook subscription to `messages` |
| Bot not replying | Check Railway logs for errors |
| Hebrew not detected | Make sure the message contains actual Hebrew characters (not transliteration) |
| Token expired | Generate a permanent System User token (Step 5) |

---

## Project Structure

```
simas-baking-whatsapp-bot/
├── src/
│   └── server.js        ← Main bot logic
├── .env.example         ← Template for your secrets
├── .env                 ← Your actual secrets (NEVER commit this)
├── package.json         ← Dependencies
└── SETUP.md             ← This guide
```

---

*Built for Sima's Baking 🎂 — Boca Raton, FL*  
*www.simasbaking.com*
