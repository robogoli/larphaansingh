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

    const revealMap = new Map();
    try {
      const revRes = await fetch(`https://krillion.io/api/reveal?date=${encodeURIComponent(data.date)}`, {
        signal: AbortSignal.timeout(12000),
        headers: {
          'User-Agent': 'LarphaanSingh-KrillionDailySync/1.0',
          Accept: 'application/json',
        },
      });
      if (revRes.ok) {
        const revData = await revRes.json();
        if (Array.isArray(revData?.prompts)) {
          for (const rp of revData.prompts) {
            if (!rp?.id || !Array.isArray(rp.answers)) continue;
            const counts = new Map();
            const compact = [];
            for (const ans of rp.answers) {
              const tier = ans?.tier;
              if (!tier) continue;
              const seen = counts.get(tier) || 0;
              // Keep all krillion/plankton/tooclever up to 45 and representative slices of other tiers
              const limit = (tier === 'krillion' || tier === 'plankton' || tier === 'tooclever') ? 45 : 30;
              if (seen < limit) {
                counts.set(tier, seen + 1);
                const item = {
                  answer: String(ans.answer || ''),
                  tier,
                  score: Number(ans.score || 0),
                };
                if (ans.quip) item.quip = String(ans.quip);
                if (Array.isArray(ans.aliases) && ans.aliases.length > 0) {
                  item.aliases = ans.aliases.slice(0, 4).map(String);
                }
                compact.push(item);
              }
            }
            revealMap.set(rp.id, {
              totalAnswers: rp.answers.length,
              resultsNote: rp.resultsNote || undefined,
              answers: compact,
            });
          }
        }
      }
    } catch {
      // Non-fatal: prompt questions still sync even if reveal endpoint is unavailable
    }

    const payload = {
      date: data.date,
      dayNumber: data.dayNumber,
      resetsAt: data.resetsAt || null,
      syncedAt: new Date().toISOString(),
      prompts: data.prompts.map((p, idx) => {
        const id = p.id || `p${idx + 1}`;
        const rev = revealMap.get(id);
        return {
          id,
          text: String(p.text || p.q || '').trim(),
          ...(rev ? { totalAnswers: rev.totalAnswers, ...(rev.resultsNote ? { resultsNote: rev.resultsNote } : {}), answers: rev.answers } : {}),
        };
      }),
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload) + '\n', 'utf-8');
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
