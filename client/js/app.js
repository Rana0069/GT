// ============================================================
// CONFIG
// ============================================================
const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 60000;   // 60 seconds
const MAX_PER_PAGE = 10;
const TOAST_DURATION = 3000;

// ============================================================
// STATE
// ============================================================
const state = {
  category: 'gaming',
  page: 1,
  articles: [],           // all loaded articles
  totalArticles: 0,
  isLoading: false,
  isRefreshing: false,
  refreshTimer: null,
  refreshCountdown: null,
  countdownValue: 60,
};

// ============================================================
// DOM REFERENCES
// ============================================================
const dom = {
  navbar:            document.getElementById('navbar'),
  mobileMenuBtn:     document.getElementById('mobile-menu-btn'),
  mobileMenu:        document.getElementById('mobile-menu'),
  heroGlow:          document.getElementById('hero-glow'),
  heroTitleGaming:   document.getElementById('hero-title-gaming'),
  heroTitleTech:     document.getElementById('hero-title-tech'),
  heroSubGaming:     document.getElementById('hero-sub-gaming'),
  heroSubTech:       document.getElementById('hero-sub-tech'),
  featuredCard:      document.getElementById('featured-card'),
  newsGrid:          document.getElementById('news-grid'),
  loadingState:      document.getElementById('loading-state'),
  errorState:        document.getElementById('error-state'),
  errorMessage:      document.getElementById('error-message'),
  emptyState:        document.getElementById('empty-state'),
  retryBtn:          document.getElementById('retry-btn'),
  loadMoreContainer: document.getElementById('load-more-container'),
  loadMoreBtn:       document.getElementById('load-more-btn'),
  refreshIndicator:  document.getElementById('refresh-indicator'),
  refreshDot:        document.getElementById('refresh-dot'),
  refreshTimerEl:    document.getElementById('refresh-timer'),
  toastContainer:    document.getElementById('toast-container'),
};

// ============================================================
// INITIALIZE LUCIDE ICONS
// ============================================================
lucide.createIcons();

// ============================================================
// NAVBAR SCROLL EFFECT
// ============================================================
let lastScrollY = 0;
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  if (scrollY > 20) {
    dom.navbar.classList.add('scrolled');
  } else {
    dom.navbar.classList.remove('scrolled');
  }
  lastScrollY = scrollY;
}, { passive: true });

// ============================================================
// MOBILE MENU
// ============================================================
dom.mobileMenuBtn.addEventListener('click', () => {
  dom.mobileMenu.classList.toggle('hidden');
});

// ============================================================
// CATEGORY SWITCHING
// ============================================================
function setActiveCategory(category) {
  state.category = category;
  state.page = 1;
  state.articles = [];
  state.totalArticles = 0;

  // Desktop tabs
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active-tab', tab.dataset.category === category);
  });

  // Mobile tabs
  document.querySelectorAll('.category-tab-mobile').forEach(tab => {
    tab.classList.toggle('active-mobile-tab', tab.dataset.category === category);
  });

  // Hero text
  dom.heroTitleGaming.classList.toggle('hidden', category !== 'gaming');
  dom.heroTitleTech.classList.toggle('hidden', category !== 'tech');
  dom.heroSubGaming.classList.toggle('hidden', category !== 'gaming');
  dom.heroSubTech.classList.toggle('hidden', category !== 'tech');

  // Hero glow color
  dom.heroGlow.className = category === 'gaming'
    ? 'absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[900px] h-[300px] md:h-[400px] rounded-full bg-blue-500/8 blur-[120px] transition-colors duration-700'
    : 'absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[900px] h-[300px] md:h-[400px] rounded-full bg-violet-500/8 blur-[120px] transition-colors duration-700';

  // Close mobile menu
  dom.mobileMenu.classList.add('hidden');

  // Fetch fresh
  fetchNews(true);
  resetRefreshTimer();
}

// Desktop tabs
document.querySelectorAll('.category-tab').forEach(tab => {
  tab.addEventListener('click', () => setActiveCategory(tab.dataset.category));
});

// Mobile tabs
document.querySelectorAll('.category-tab-mobile').forEach(tab => {
  tab.addEventListener('click', () => setActiveCategory(tab.dataset.category));
});

// ============================================================
// FETCH NEWS
// ============================================================
async function fetchNews(reset = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (reset) {
    state.articles = [];
    state.page = 1;
    dom.newsGrid.innerHTML = '';
    dom.featuredCard.innerHTML = '';
    dom.featuredCard.classList.add('hidden');
    dom.loadMoreContainer.classList.add('hidden');
  }

  // Show loading only if grid is empty
  if (state.articles.length === 0) {
    showState('loading');
  }

  try {
    const url = `${API_BASE}/api/news?category=${state.category}&page=${state.page}&max=${MAX_PER_PAGE}`;
    const response = await fetch(url);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Server returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      if (state.articles.length === 0) {
        showState('empty');
      }
      state.isLoading = false;
      return;
    }

    state.totalArticles = data.totalArticles;
    const newArticles = data.articles;
    state.articles.push(...newArticles);

    // Render
    if (reset) {
      renderFeatured(newArticles[0]);
      renderCards(newArticles.slice(1));
    } else {
      renderCards(newArticles);
    }

    // Show/hide load more
    const hasMore = state.articles.length < state.totalArticles;
    dom.loadMoreContainer.classList.toggle('hidden', !hasMore);

    showState('grid');

    // Toast on refresh
    if (data.cached) {
      showToast('Loaded from cache', 'info');
    } else if (state.isRefreshing) {
      showToast('News refreshed', 'success');
    }

  } catch (err) {
    console.error('Fetch error:', err);
    if (state.articles.length === 0) {
      dom.errorMessage.textContent = err.message || 'Something went wrong. Please try again.';
      showState('error');
    } else {
      showToast(err.message || 'Failed to load more articles', 'error');
    }
  } finally {
    state.isLoading = false;
    state.isRefreshing = false;
  }
}

// ============================================================
// RENDER FEATURED CARD
// ============================================================
function renderFeatured(article) {
  if (!article) return;

  const imgHtml = article.image
    ? `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" loading="eager" onerror="this.parentElement.innerHTML='<div class=\\'card-image-placeholder\\'><svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' fill=\\'none\\' stroke=\\'rgba(255,255,255,0.15)\\' stroke-width=\\'1.5\\' viewBox=\\'0 0 24 24\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'m21 15-5-5L5 21\\'/></svg></div>'" />`
    : `<div class="card-image-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`;

  dom.featuredCard.innerHTML = `
    <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="featured-card">
      <div class="featured-image">${imgHtml}</div>
      <div class="featured-body">
        <div class="featured-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Featured
        </div>
        <h2 class="featured-title">${escapeHtml(article.title)}</h2>
        <p class="featured-description">${escapeHtml(article.description)}</p>
        <div class="featured-meta">
          <span>${escapeHtml(article.source.name)}</span>
          <span>•</span>
          <span>${formatDate(article.publishedAt)}</span>
        </div>
      </div>
    </a>
  `;
  dom.featuredCard.classList.remove('hidden');
}

// ============================================================
// RENDER CARDS
// ============================================================
function renderCards(articles) {
  const fragment = document.createDocumentFragment();

  articles.forEach(article => {
    const card = document.createElement('a');
    card.href = escapeHtml(article.url);
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.className = 'news-card';

    const imgHtml = article.image
      ? `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-image-placeholder\\'><svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' fill=\\'none\\' stroke=\\'rgba(255,255,255,0.12)\\' stroke-width=\\'1.5\\' viewBox=\\'0 0 24 24\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'m21 15-5-5L5 21\\'/></svg></div>'" />`
      : `<div class="card-image-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`;

    card.innerHTML = `
      <div class="card-image">${imgHtml}</div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-source">${escapeHtml(article.source.name)}</span>
          <span class="card-dot"></span>
          <span class="card-date">${formatDate(article.publishedAt)}</span>
        </div>
        <h3 class="card-title">${escapeHtml(article.title)}</h3>
        <p class="card-description">${escapeHtml(article.description)}</p>
      </div>
      <div class="card-footer">
        <span class="card-read">Read article</span>
        <svg class="card-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    `;

    fragment.appendChild(card);
  });

  dom.newsGrid.appendChild(fragment);
}

// ============================================================
// STATE MANAGEMENT
// ============================================================
function showState(stateName) {
  dom.loadingState.classList.add('hidden');
  dom.errorState.classList.add('hidden');
  dom.emptyState.classList.add('hidden');
  dom.newsGrid.classList.add('hidden');
  dom.featuredCard.classList.add('hidden');

  switch (stateName) {
    case 'loading':
      dom.loadingState.classList.remove('hidden');
      break;
    case 'error':
      dom.errorState.classList.remove('hidden');
      lucide.createIcons(); // re-render icons in error state
      break;
    case 'empty':
      dom.emptyState.classList.remove('hidden');
      lucide.createIcons();
      break;
    case 'grid':
      dom.newsGrid.classList.remove('hidden');
      if (dom.featuredCard.innerHTML) {
        dom.featuredCard.classList.remove('hidden');
      }
      break;
  }
}

// ============================================================
// LOAD MORE
// ============================================================
dom.loadMoreBtn.addEventListener('click', () => {
  if (state.isLoading) return;
  state.page++;
  dom.loadMoreBtn.classList.add('loading');
  fetchNews(false).finally(() => {
    dom.loadMoreBtn.classList.remove('loading');
  });
});

// ============================================================
// RETRY
// ============================================================
dom.retryBtn.addEventListener('click', () => {
  fetchNews(true);
  resetRefreshTimer();
});

// ============================================================
// AUTO-REFRESH
// ============================================================
function startRefreshTimer() {
  state.countdownValue = 60;
  dom.refreshIndicator.classList.remove('hidden');
  dom.refreshTimerEl.textContent = `${state.countdownValue}s`;

  state.refreshCountdown = setInterval(() => {
    state.countdownValue--;
    dom.refreshTimerEl.textContent = `${state.countdownValue}s`;

    if (state.countdownValue <= 10) {
      dom.refreshDot.classList.add('refresh-pulse');
    }

    if (state.countdownValue <= 0) {
      triggerRefresh();
    }
  }, 1000);
}

function resetRefreshTimer() {
  clearInterval(state.refreshCountdown);
  dom.refreshDot.classList.remove('refresh-pulse');
  startRefreshTimer();
}

function triggerRefresh() {
  clearInterval(state.refreshCountdown);
  state.isRefreshing = true;

  // Flash the dot
  dom.refreshDot.style.background = '#3b82f6';
  setTimeout(() => {
    dom.refreshDot.style.background = '#22c55e';
  }, 1000);

  // Re-fetch page 1
  state.page = 1;
  state.articles = [];
  dom.newsGrid.innerHTML = '';
  dom.featuredCard.innerHTML = '';
  dom.featuredCard.classList.add('hidden');

  fetchNews(true).finally(() => {
    resetRefreshTimer();
  });
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';

  let iconSvg = '';
  let iconColor = '#3b82f6';

  switch (type) {
    case 'success':
      iconColor = '#22c55e';
      iconSvg = `<svg class="toast-icon" style="color:${iconColor}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;
      break;
    case 'error':
      iconColor = '#ef4444';
      iconSvg = `<svg class="toast-icon" style="color:${iconColor}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`;
      break;
    default:
      iconSvg = `<svg class="toast-icon" style="color:${iconColor}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, TOAST_DURATION);
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return '';
  }
}

// ============================================================
// INIT
// ============================================================
fetchNews(true);
startRefreshTimer();
