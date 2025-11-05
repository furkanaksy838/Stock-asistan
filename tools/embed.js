try {
  require("dotenv").config();
} catch (e) {}
const cds = require("@sap/cds");
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function embed(text) {
  const KEY = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(KEY);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const res = await model.embedContent(text);
  return res?.embedding?.values || [];
}

(async () => {
  const db = await cds.connect.to("db");
  const products = await db.run(`SELECT sku, name FROM data_Products`);
  for (const p of products) {
    const text = `${p.sku} ${p.name}`;
    const vec = await embed(text);
    await db.run(
      `INSERT OR REPLACE INTO data_ProductVectors (sku, embedding) VALUES (?, ?)`,
      [p.sku, JSON.stringify(vec)]
    );
    console.log("✓ embedded:", p.sku);
  }
  console.log(" Bitti");
  process.exit(0);
})();
// Note: To run this file, use the following in the terminal:
//    node tools/embed.js
