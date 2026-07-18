import OpenAI from "openai";
import { config } from "./config.js";
import type { BotState, GeneratedPost } from "./types.js";
import { moscowDateParts, normalizeUrl, parseJsonObject, sleep } from "./utils.js";

const SAMPLE: GeneratedPost = {
  skip: false,
  category: "РАЗБОР ТРЕНДА",
  title: "Почему мягкая текстура снова вытесняет жёсткую укладку",
  lead: "В свежих мужских и женских образах всё чаще оставляют естественное движение волос вместо идеально зафиксированной формы.",
  points: [
    "Текстура делает образ визуально легче и современнее.",
    "Для тонких волос важнее лёгкий объём, а не большое количество стайлинга.",
    "Форму лучше подбирать под геометрию лица, а не копировать референс целиком.",
  ],
  takeaway: "Начните с малого: уменьшите количество фиксирующего средства и сохраните подвижность прядей у лица.",
  sourceName: "Демонстрационный источник",
  sourceUrl: "https://example.com/faceform-demo",
  hashtags: ["FaceForm", "стиль", "волосы"],
};

function topicForRun(hour: number): string {
  if (hour < 15) {
    return "свежая новость или заметный тренд из моды, причёсок, мужского/женского груминга, beauty-tech или индустрии ухода";
  }
  return "практический разбор свежего тренда: луксмаксинг без токсичных оценок, улучшение образа, одежда, волосы, макияж, борода или безопасный базовый уход";
}

function validate(post: GeneratedPost): GeneratedPost {
  if (post.skip) return post;
  if (!post.title?.trim() || !post.lead?.trim() || !post.takeaway?.trim()) {
    throw new Error("Сгенерированный пост неполный");
  }
  if (!Array.isArray(post.points) || post.points.length < 2 || post.points.length > 4) {
    throw new Error("Нужно от 2 до 4 тезисов");
  }
  if (!post.sourceName?.trim() || !post.sourceUrl?.startsWith("http")) {
    throw new Error("Нет корректного источника");
  }
  post.sourceUrl = normalizeUrl(post.sourceUrl);
  post.hashtags = Array.isArray(post.hashtags) ? post.hashtags.slice(0, 4) : ["FaceForm"];
  post.title = post.title.slice(0, 115);
  post.lead = post.lead.slice(0, 330);
  post.points = post.points.map((item) => item.slice(0, 220));
  post.takeaway = post.takeaway.slice(0, 300);
  return post;
}

export async function generatePost(state: BotState): Promise<GeneratedPost> {
  if (config.sampleMode) return SAMPLE;

  const openai = new OpenAI({ apiKey: config.openaiApiKey });
  const now = moscowDateParts();
  const recent = state.posts.slice(-30).map((item) => ({ title: item.title, sourceUrl: item.sourceUrl }));
  const domainLine = config.allowedDomains.length
    ? `Ищи только на доменах: ${config.allowedDomains.join(", ")}.`
    : "Приоритет: авторитетные модные и beauty-издания, официальные пресс-релизы брендов, профессиональные ассоциации и первичные источники.";

  const prompt = `
Сегодня ${now.label}, московское время. Подготовь один готовый пост для Telegram-канала FaceForm на русском языке.

Тема запуска: ${topicForRun(now.hour)}.
Используй web search и сначала найди материал, опубликованный преимущественно за последние 72 часа. Если достойной свежей новости нет, выбери действительно актуальный тренд последних 30 дней и честно подай его как разбор тренда, а не как срочную новость.
${domainLine}

Недавние публикации, которые нельзя повторять:
${JSON.stringify(recent)}

Редакционные правила:
- Пиши оригинальный пересказ, не копируй заголовок и длинные фразы источника.
- Один основной источник, URL должен быть настоящим URL найденной страницы.
- Не используй анонимные Telegram-каналы, TikTok, Reddit или посты инфлюенсеров как единственный источник.
- Для медицинских или дерматологических утверждений используй только официальные профессиональные/медицинские источники; лучше избегай диагностики и лечения.
- Не стыди внешность, вес, возраст, кожу, волосы или тело.
- Не обещай гарантированное улучшение привлекательности, не поощряй навязчивую оценку лица.
- Не советуй операции, препараты, экстремальные диеты и похудение по внешности.
- Разделяй мужские и женские примеры, когда это важно; не выдавай гендер по фотографии.
- Тон: стильный, полезный, уверенный, без кликбейта и канцелярита.
- Заголовок до 100 символов. Lead 1–2 предложения. 2–4 коротких тезиса. Практический вывод.
- Общий будущий Telegram-текст должен помещаться примерно в 900 символов вместе со ссылкой и хэштегами.
- Если надёжной темы нет, верни skip=true.

Верни ТОЛЬКО валидный JSON без markdown:
{
  "skip": false,
  "category": "НОВОСТЬ | МОДА | ВОЛОСЫ | УХОД | ЛУКСМАКСИНГ | РАЗБОР ТРЕНДА",
  "title": "...",
  "lead": "...",
  "points": ["...", "..."],
  "takeaway": "...",
  "sourceName": "...",
  "sourceUrl": "https://...",
  "publishedAt": "YYYY-MM-DD или пустая строка",
  "hashtags": ["FaceForm", "мода"]
}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const tool: Record<string, unknown> = {
        type: "web_search",
        search_context_size: "medium",
        user_location: {
          type: "approximate",
          country: "RU",
          timezone: "Europe/Moscow",
        },
      };
      if (config.allowedDomains.length) {
        tool.filters = { allowed_domains: config.allowedDomains };
      }

      const response = await openai.responses.create({
        model: config.openaiModel,
        tools: [tool as never],
        input: prompt,
      });
      return validate(parseJsonObject<GeneratedPost>(response.output_text));
    } catch (error) {
      lastError = error;
      console.warn(`Попытка генерации ${attempt} не удалась:`, error);
      if (attempt < 3) await sleep(1200 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Не удалось создать пост");
}
