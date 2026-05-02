require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GNEWS_API_KEY;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 55000;

// ---------------------------------------------------------------------------
// In-memory cache: { key: { data, fetchedAt } }
// ---------------------------------------------------------------------------
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, fetchedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Validate API key on startup
// ---------------------------------------------------------------------------
if (!API_KEY || API_KEY === 'your_gnews_api_key_here') {
  console.warn(
    '\x1b[33m%s\x1b[0m',
    '⚠  WARNING: No valid GNEWS_API_KEY set in .env — API calls will fail.\n' +
    '   Get a free key at https://gnews.io then add it to server/.env\n'
  );
}

// ---------------------------------------------------------------------------
// Serve static client files
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'client')));

// ---------------------------------------------------------------------------
// NEWS ENDPOINT
// GET /api/news?category=gaming|tech&page=1&max=10
// ---------------------------------------------------------------------------
app.get('/api/news', async (req, res) => {
  const { category = 'gaming', page = '1', max = '10' } = req.query;

  // Validate category
  const validCategories = ['gaming', 'tech'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
    });
  }

  // Validate pagination
  const pageNum = Math.max(1, parseInt(page) || 1);
  const maxNum = Math.min(10, Math.max(1, parseInt(max) || 10));

  // Build cache key
  const cacheKey = `${category}_p${pageNum}_m${maxNum}`;

  // Return cached data if fresh
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  // Build GNews API URL
  const query = category === 'gaming' ? 'video games gaming' : 'technology tech';
  const gnewsUrl = new URL('https://gnews.io/api/v4/search');
  gnewsUrl.searchParams.set('q', query);
  gnewsUrl.searchParams.set('lang', 'en');
  gnewsUrl.searchParams.set('country', 'us');
  gnewsUrl.searchParams.set('max', String(maxNum));
  gnewsUrl.searchParams.set('page', String(pageNum));
  gnewsUrl.searchParams.set('token', API_KEY);

  try {
    const response = await fetch(gnewsUrl.toString());

    if (!response.ok) {
      const body = await response.text();
      let errorMsg;
      try {
        const parsed = JSON.parse(body);
        errorMsg = parsed.errors?.join(', ') || parsed.message || body;
      } catch {
        errorMsg = body;
      }

      if (response.status === 403 || response.status === 401) {
        return res.status(502).json({
          error: 'Invalid or missing API key. Please check your GNEWS_API_KEY in .env'
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          error: 'API rate limit reached. Please wait a moment and try again.'
        });
      }

      return res.status(502).json({
        error: `Upstream API error (${response.status}): ${errorMsg}`
      });
    }

    const data = await response.json();

    // Transform articles to a clean shape
    const articles = (data.articles || []).map((article) => ({
      title: article.title || 'Untitled',
      description: article.description || 'No description available.',
      content: article.content || '',
      url: article.url || '#',
      image: article.image || null,
      publishedAt: article.publishedAt || null,
      source: {
        name: article.source?.name || 'Unknown',
        url: article.source?.url || '#'
      }
    }));

    const result = {
      category,
      page: pageNum,
      max: maxNum,
      totalArticles: data.totalArticles || 0,
      articles,
      cached: false
    };

    // Cache the result
    setCache(cacheKey, result);

    return res.json(result);

  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({
      error: `Failed to fetch news: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), cacheSize: cache.size });
});

// ---------------------------------------------------------------------------
// SPA fallback — serve index.html for any non-API route
// ---------------------------------------------------------------------------
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\x1b[36m%s\x1b[0m`, `🚀 Server running at http://localhost:${PORT}`);
  console.log(`   News API: http://localhost:${PORT}/api/news?category=gaming`);
  console.log(`   Health:   http://localhost:${PORT}/api/health\n`);
});
