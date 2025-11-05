import "dotenv/config";
import cds from "@sap/cds";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
let BetterSqlite3;
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toFloat32Buffer(arr = []) {
  const n = arr.length;
  const buffer = Buffer.allocUnsafe(n * 4);

  arr.forEach((value, i) => {
    buffer.writeFloatLE(value ?? 0, i * 4);
  });

  return buffer;
}

async function callGemini(prompt) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return "Gemini API anahtarı yok.";
  const MODEL = process.env.AI_MODEL || "gemini-2.5-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        candidateCount: 1,
      },
    }),
  });
  const raw = await res.text();
  try {
    const j = JSON.parse(raw);
    const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (txt && String(txt).trim()) return txt;
    const fb = j?.promptFeedback || j?.candidates?.[0]?.safetyRatings;
    return fb ? `Cevap yok (LLM feedback): ${JSON.stringify(fb)}` : "Cevap yok";
  } catch {
    return raw || "Cevap yok";
  }
}

async function embed(text = "") {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const { embedding } = await model.embedContent(text);
    return embedding?.values ?? [];
  } catch (err) {
    console.error("Embed error:", err);
    return [];
  }
}

async function retrieveProducts(query) {
  const qvec = await embed(query);
  if (!qvec.length)
    return { error: "Embedding üretilemedi (Gemini).", products: [] };
  if (!BetterSqlite3) BetterSqlite3 = (await import("better-sqlite3")).default;
  const dbPath =
    process.env.SQLITE_DB_PATH || path.resolve(__dirname, "..", "sqlite.db");
  const db = new BetterSqlite3(dbPath);
  try {
    const dll = path.resolve(__dirname, "..", "sqlite-extensions", "vec0.dll");
    if (fs.existsSync(dll)) db.loadExtension(dll);
  } catch {}
  const buf = toFloat32Buffer(qvec);
  let rows = [];
  try {
    rows = db
      .prepare(
        `
        SELECT sku, vec_distance_cos(embedding, ?) AS dist
        FROM vec_product_vectors
        ORDER BY dist ASC
        LIMIT 5 
      `
      )
      .all(buf);
  } catch (e) {
    try {
      rows = db
        .prepare(
          `
          SELECT sku, vec_distance_l2(embedding, ?) AS dist
          FROM vec_product_vectors
          ORDER BY dist ASC
          LIMIT 1000
        `
        )
        .all(buf);
    } catch {}
  }
  try {
    db.close();
  } catch {}
  const skus = rows.map((r) => r.sku);
  const products = await cds.run`
      SELECT *
      FROM data.Products
      WHERE sku in ${skus}
    `;
  return { products };
}

async function generateAnswer(query, products) {
  const lines = products
    .map(
      (p) =>
        "- " +
        Object.entries(p)
          .map(([k, v]) => `${k}: ${v ?? "?"}`)
          .join(" | ")
    )
    .join("\n");
  const prompt = `Kullanıcı: "${query}"

Ürün verileri (sadece bunlara dayan):
${lines}

Kurallar:
- Sadece yukarıdaki verilere dayan, uydurma bilgi verme.
- Kısa ve net Türkçe cevap ver.
- Eğer kullanıcı spesifik SKU/ürün sormamışsa, en yakın 1-3 uygun ürünü özetle.
`;
  const answer = await callGemini(prompt);
  return answer;
}

export default (srv) => {
  srv.on("chat", async (req) => {
    const { message } = req.data || {};
    const query = String(message || "").trim();
    if (!query) return { content: "Soru/metin boş olamaz." };
    const { products, error } = await retrieveProducts(query);
    if (error) return { content: error };
    const answer = await generateAnswer(query, products);
    return { content: answer };
  });
};
