import "dotenv/config";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана обязательная переменная ${name}`);
  return value;
}

function bool(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

const sampleMode = bool("SAMPLE_MODE");
const dryRun = bool("DRY_RUN");

export const config = {
  sampleMode,
  dryRun,
  disableCard: bool("DISABLE_CARD"),
  telegramBotToken: sampleMode || dryRun ? process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "" : required("TELEGRAM_BOT_TOKEN"),
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID?.trim() || "@your_channel",
  openaiApiKey: sampleMode ? process.env.OPENAI_API_KEY?.trim() ?? "" : required("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
  faceformBotUrl: process.env.FACEFORM_BOT_URL?.trim() || "https://t.me/your_faceform_bot?startapp",
  channelName: process.env.CHANNEL_NAME?.trim() || "FaceForm | Разбор внешности",
  channelUsername: process.env.CHANNEL_USERNAME?.trim() || "@faceform",
  stateFile: process.env.STATE_FILE?.trim() || path.resolve("data/content-bot-state.json"),
  allowedDomains: (process.env.SEARCH_ALLOWED_DOMAINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
};
