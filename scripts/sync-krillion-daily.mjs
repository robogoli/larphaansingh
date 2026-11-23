import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '..', 'public', 'games', 'krillion', 'daily.json');
const KRILLION_TODAY_URL = 'https://krillion.io/api/today';

async function syncDaily() {
  try {
    const res = await fetch(KRILLION_TODAY_URL, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'LarphaanSingh-KrillionDailySync/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (
      !data ||
      typeof data.date !== 'string' ||
      typeof data.dayNumber !== 'number' ||
      !Array.isArray(data.prompts) ||
      data.prompts.length === 0
    ) {
      throw new Error('Unexpected payload schema from krillion.io/api/today');
    }

    const payload = {
      date: data.date,
      dayNumber: data.dayNumber,
      resetsAt: data.resetsAt || null,
      syncedAt: new Date().toISOString(),
      prompts: data.prompts.map((p, idx) => ({
        id: p.id || `p${idx + 1}`,
        text: String(p.text || p.q || '').trim(),
      })),
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
    console.log(`Synced Krillion Dive #${payload.dayNumber} (${payload.date}) -> ${OUTPUT_PATH}`);
  } catch (err) {
    if (fs.existsSync(OUTPUT_PATH)) {
      console.warn(`Krillion sync skipped (${err.message}); keeping existing daily.json.`);
      return;
    }
    console.error('Krillion sync failed with no fallback daily.json:', err);
    process.exitCode = 1;
  }
}

syncDaily();
