#!/usr/bin/env node

/**
 * Build script for One File Tools.
 *
 * Reads tools.json and generates index.html.
 * Zero npm dependencies - runs with plain Node.js.
 *
 * Usage:
 *   node build.js
 *
 * Cloudflare Pages build command:
 *   node build.js
 */

const fs = require("fs");
const path = require("path");

// ──────────────────────────────────────────────
// Load data
// ──────────────────────────────────────────────

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "tools.json"), "utf-8"));
const { site, categories, tools } = data;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Minimal Markdown-to-HTML converter.
 * Handles: headers, bold, italic, links, inline code,
 * fenced code blocks, unordered/ordered lists, paragraphs.
 */
function markdownToHtml(md) {
  if (!md) return "";
  const lines = md.split("\n");
  let html = "";
  let inCodeBlock = false;
  let inList = false;
  let listType = "";
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      html += "<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>\n";
      paragraph = [];
    }
  }

  function closeList() {
    if (inList) {
      html += listType === "ul" ? "</ul>\n" : "</ol>\n";
      inList = false;
      listType = "";
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        flushParagraph();
        closeList();
        inCodeBlock = true;
        html += "<pre><code>";
      } else {
        inCodeBlock = false;
        html += "</code></pre>\n";
      }
      continue;
    }

    if (inCodeBlock) {
      html += escapeHtml(line) + "\n";
      continue;
    }

    const trimmed = line.trim();

    // Blank line
    if (trimmed === "") {
      flushParagraph();
      closeList();
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      flushParagraph();
      closeList();
      const level = headerMatch[1].length;
      html += `<h${level}>${inlineMarkdown(headerMatch[2])}</h${level}>\n`;
      continue;
    }

    // Unordered list
    if (trimmed.match(/^[-*+]\s+/)) {
      flushParagraph();
      if (!inList || listType !== "ul") {
        closeList();
        html += "<ul>\n";
        inList = true;
        listType = "ul";
      }
      html += "<li>" + inlineMarkdown(trimmed.replace(/^[-*+]\s+/, "")) + "</li>\n";
      continue;
    }

    // Ordered list
    if (trimmed.match(/^\d+\.\s+/)) {
      flushParagraph();
      if (!inList || listType !== "ol") {
        closeList();
        html += "<ol>\n";
        inList = true;
        listType = "ol";
      }
      html += "<li>" + inlineMarkdown(trimmed.replace(/^\d+\.\s+/, "")) + "</li>\n";
      continue;
    }

    // Regular text line (collect into paragraph)
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  if (inCodeBlock) html += "</code></pre>\n";

  return html;
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/**
 * Check if a thumbnail file exists for a tool.
 */
function thumbnailExists(toolId) {
  const thumbPath = path.join(__dirname, "tools", toolId + ".png");
  return fs.existsSync(thumbPath);
}

// ──────────────────────────────────────────────
// Build tool data for embedding in HTML
// ──────────────────────────────────────────────

const categoryMap = {};
categories.forEach((c) => {
  categoryMap[c.id] = c;
});

const toolsForEmbed = tools.map((tool) => ({
  id: tool.id,
  name: tool.name,
  shortDescription: tool.shortDescription,
  longDescriptionHtml: markdownToHtml(tool.longDescription),
  category: tool.category,
  categoryName: categoryMap[tool.category]?.name || tool.category,
  categoryIcon: categoryMap[tool.category]?.icon || "",
  tags: tool.tags || [],
  techStack: tool.techStack || [],
  difficulty: tool.difficulty || "Easy",
  status: tool.status || "idea",
  hasThumbnail: thumbnailExists(tool.id),
  file: `tools/${tool.id}.html`,
  thumbnail: `tools/${tool.id}.png`,
  github: `${site.github}/blob/main/tools/${tool.id}.html`,
  live: `${site.url}/tools/${tool.id}.html`
}));

// Count tools per category
const categoryCounts = {};
tools.forEach((t) => {
  categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
});

const liveToolCount = tools.filter((t) => t.status === "live").length;
const totalToolCount = tools.length;

// ──────────────────────────────────────────────
// Generate HTML
// ──────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(site.title)} - ${escapeHtml(site.tagline)}</title>
    <meta name="description" content="${escapeHtml(site.description)}" />
    <meta property="og:title" content="${escapeHtml(site.title)}" />
    <meta property="og:description" content="${escapeHtml(site.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(site.url)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(site.title)}" />
    <meta name="twitter:description" content="${escapeHtml(site.description)}" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛠️</text></svg>" />
    <style>
      /* ========================================
         Custom Properties
         ======================================== */
      :root {
        --bg: #fafafa;
        --bg-elevated: #ffffff;
        --bg-hover: #f5f5f5;
        --bg-hero: #0a0a0a;
        --bg-overlay: rgba(0, 0, 0, 0.6);
        --text: #18181b;
        --text-muted: #71717a;
        --text-hero: #ffffff;
        --text-hero-muted: #a1a1aa;
        --accent: #3b82f6;
        --accent-hover: #2563eb;
        --border: #e4e4e7;
        --tag-bg: #eff6ff;
        --tag-text: #1d4ed8;
        --easy-bg: #dcfce7;
        --easy-text: #166534;
        --medium-bg: #fef9c3;
        --medium-text: #854d0e;
        --live-bg: #dcfce7;
        --live-text: #166534;
        --idea-bg: #f3f4f6;
        --idea-text: #6b7280;
        --radius: 12px;
        --radius-sm: 8px;
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
        --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
        --shadow-lg: 0 10px 40px rgba(0,0,0,0.1);
        --shadow-xl: 0 20px 60px rgba(0,0,0,0.15);
        --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        --font-mono: "SF Mono", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace;
        --transition: 0.2s ease;
      }

      [data-theme="dark"] {
        --bg: #09090b;
        --bg-elevated: #18181b;
        --bg-hover: #27272a;
        --bg-overlay: rgba(0, 0, 0, 0.75);
        --text: #fafafa;
        --text-muted: #a1a1aa;
        --border: #27272a;
        --tag-bg: #1e1b4b;
        --tag-text: #a5b4fc;
        --easy-bg: #052e16;
        --easy-text: #86efac;
        --medium-bg: #422006;
        --medium-text: #fde047;
        --live-bg: #052e16;
        --live-text: #86efac;
        --idea-bg: #27272a;
        --idea-text: #a1a1aa;
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
        --shadow: 0 1px 3px rgba(0,0,0,0.3);
        --shadow-lg: 0 10px 40px rgba(0,0,0,0.4);
        --shadow-xl: 0 20px 60px rgba(0,0,0,0.5);
      }

      /* ========================================
         Reset & Base
         ======================================== */
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }

      body {
        font-family: var(--font);
        line-height: 1.6;
        color: var(--text);
        background: var(--bg);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }

      /* ========================================
         Nav
         ======================================== */
      .nav {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--bg-elevated);
        border-bottom: 1px solid var(--border);
        padding: 0.75rem 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .nav-brand {
        font-weight: 700;
        font-size: 1.05rem;
        color: var(--text);
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .nav-brand:hover { text-decoration: none; }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .nav-links a {
        font-size: 0.85rem;
        color: var(--text-muted);
        transition: color var(--transition);
      }

      .nav-links a:hover { color: var(--text); text-decoration: none; }

      .theme-toggle {
        background: none;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.35rem 0.55rem;
        cursor: pointer;
        font-size: 1rem;
        color: var(--text);
        transition: all var(--transition);
        line-height: 1;
      }

      .theme-toggle:hover { background: var(--bg-hover); }

      /* ========================================
         Hero
         ======================================== */
      .hero {
        background: var(--bg-hero);
        padding: 5rem 1.5rem 4rem;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      .hero::before {
        content: "";
        position: absolute;
        top: -50%; left: -50%;
        width: 200%; height: 200%;
        background:
          radial-gradient(circle at 30% 40%, rgba(59,130,246,0.07) 0%, transparent 50%),
          radial-gradient(circle at 70% 60%, rgba(168,85,247,0.05) 0%, transparent 50%);
        pointer-events: none;
      }

      .hero-content { position: relative; z-index: 1; }

      .hero h1 {
        font-size: clamp(2.2rem, 5.5vw, 3.5rem);
        font-weight: 800;
        color: var(--text-hero);
        letter-spacing: -0.03em;
        line-height: 1.15;
        margin-bottom: 0.75rem;
      }

      .hero h1 .gradient {
        background: linear-gradient(135deg, #60a5fa, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .hero p {
        color: var(--text-hero-muted);
        font-size: 1.1rem;
        max-width: 540px;
        margin: 0 auto 2rem;
      }

      .hero-buttons {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.7rem 1.4rem;
        border-radius: var(--radius-sm);
        font-weight: 600;
        font-size: 0.9rem;
        font-family: var(--font);
        transition: all var(--transition);
        text-decoration: none;
        border: none;
        cursor: pointer;
      }

      .btn:hover { text-decoration: none; }
      .btn-primary { background: var(--accent); color: #fff; }
      .btn-primary:hover { background: var(--accent-hover); }
      .btn-ghost { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); }
      .btn-ghost:hover { background: rgba(255,255,255,0.14); }

      /* ========================================
         Stats
         ======================================== */
      .stats {
        display: flex;
        justify-content: center;
        gap: 2.5rem;
        padding: 2.5rem 1.5rem;
        flex-wrap: wrap;
        max-width: 750px;
        margin: 0 auto;
      }

      .stat { text-align: center; }
      .stat-num { font-size: 2rem; font-weight: 800; color: var(--accent); line-height: 1; }
      .stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; }

      /* ========================================
         Search & Filters
         ======================================== */
      .controls {
        max-width: 1140px;
        margin: 0 auto;
        padding: 0 1.5rem 1.5rem;
      }

      .search-bar {
        position: relative;
        max-width: 480px;
        margin: 0 auto 1.25rem;
      }

      .search-bar input {
        width: 100%;
        padding: 0.7rem 1rem 0.7rem 2.6rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--bg-elevated);
        color: var(--text);
        font-size: 0.9rem;
        font-family: var(--font);
        outline: none;
        transition: border-color var(--transition), box-shadow var(--transition);
      }

      .search-bar input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
      }

      .search-bar svg {
        position: absolute;
        left: 0.85rem;
        top: 50%;
        transform: translateY(-50%);
        width: 16px; height: 16px;
        color: var(--text-muted);
        pointer-events: none;
      }

      .filters {
        display: flex;
        justify-content: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .filter-btn {
        font-family: var(--font);
        font-size: 0.8rem;
        padding: 0.35rem 0.8rem;
        border: 1px solid var(--border);
        border-radius: 20px;
        background: var(--bg-elevated);
        color: var(--text-muted);
        cursor: pointer;
        transition: all var(--transition);
        white-space: nowrap;
      }

      .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
      .filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

      .results-count {
        text-align: center;
        font-size: 0.8rem;
        color: var(--text-muted);
        margin-top: 0.75rem;
      }

      /* ========================================
         Tool Grid
         ======================================== */
      .grid-container {
        max-width: 1140px;
        margin: 0 auto;
        padding: 0 1.5rem 3rem;
      }

      .tool-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 1rem;
      }

      .tool-card {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        cursor: pointer;
        transition: all var(--transition);
        display: flex;
        flex-direction: column;
      }

      .tool-card:hover {
        box-shadow: var(--shadow-lg);
        transform: translateY(-3px);
        border-color: var(--accent);
      }

      .tool-card-thumb {
        width: 100%;
        height: 180px;
        object-fit: cover;
        background: var(--bg-hover);
        display: block;
      }

      .tool-card-thumb-placeholder {
        width: 100%;
        height: 180px;
        background: var(--bg-hover);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.5rem;
        color: var(--text-muted);
        user-select: none;
      }

      .tool-card-body {
        padding: 1.1rem 1.25rem;
        flex: 1;
        display: flex;
        flex-direction: column;
      }

      .tool-card-body h3 {
        font-size: 1rem;
        font-weight: 650;
        margin-bottom: 0.3rem;
      }

      .tool-card-body p {
        font-size: 0.83rem;
        color: var(--text-muted);
        margin-bottom: 0.75rem;
        flex: 1;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .tool-card-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }

      .tag {
        display: inline-block;
        font-size: 0.68rem;
        font-weight: 600;
        padding: 0.18rem 0.5rem;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .tag-category { background: var(--tag-bg); color: var(--tag-text); }
      .tag-easy { background: var(--easy-bg); color: var(--easy-text); }
      .tag-medium { background: var(--medium-bg); color: var(--medium-text); }
      .tag-live { background: var(--live-bg); color: var(--live-text); }
      .tag-idea { background: var(--idea-bg); color: var(--idea-text); }

      .no-results {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--text-muted);
        font-size: 1rem;
        display: none;
      }

      /* ========================================
         Modal
         ======================================== */
      .modal-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 200;
        background: var(--bg-overlay);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        padding: 2rem 1rem;
        overflow-y: auto;
      }

      .modal-overlay.open { display: flex; align-items: flex-start; justify-content: center; }

      .modal {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        max-width: 700px;
        width: 100%;
        margin-top: 2vh;
        box-shadow: var(--shadow-xl);
        overflow: hidden;
        animation: modalIn 0.25s ease;
      }

      @keyframes modalIn {
        from { opacity: 0; transform: translateY(16px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .modal-thumb {
        width: 100%;
        height: 260px;
        object-fit: cover;
        background: var(--bg-hover);
        display: block;
      }

      .modal-thumb-placeholder {
        width: 100%;
        height: 200px;
        background: var(--bg-hover);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 4rem;
        color: var(--text-muted);
        user-select: none;
      }

      .modal-header {
        padding: 1.5rem 1.75rem 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .modal-header h2 { font-size: 1.4rem; font-weight: 700; }

      .modal-close {
        background: var(--bg-hover);
        border: 1px solid var(--border);
        border-radius: 8px;
        width: 36px; height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.2rem;
        color: var(--text-muted);
        transition: all var(--transition);
        flex-shrink: 0;
      }

      .modal-close:hover { background: var(--border); color: var(--text); }

      .modal-meta {
        padding: 0.75rem 1.75rem;
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .modal-links {
        padding: 0 1.75rem;
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .modal-links .btn { font-size: 0.82rem; padding: 0.5rem 1rem; }
      .btn-outline { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
      .btn-outline:hover { background: var(--accent); color: #fff; }

      .modal-body {
        padding: 1.25rem 1.75rem 1.75rem;
      }

      .modal-body h2 { font-size: 1.2rem; font-weight: 700; margin: 1rem 0 0.5rem; }
      .modal-body h3 { font-size: 1rem; font-weight: 650; margin: 1rem 0 0.4rem; }
      .modal-body p { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.75rem; }
      .modal-body ul, .modal-body ol { padding-left: 1.25rem; margin-bottom: 0.75rem; }
      .modal-body li { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.25rem; }
      .modal-body code { font-family: var(--font-mono); font-size: 0.85em; background: var(--bg-hover); padding: 0.15rem 0.35rem; border-radius: 4px; }
      .modal-body pre { background: var(--bg-hover); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 1rem; overflow-x: auto; margin-bottom: 0.75rem; }
      .modal-body pre code { background: none; padding: 0; }

      .modal-section {
        border-top: 1px solid var(--border);
        padding: 1rem 1.75rem;
      }

      .modal-section-title {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        margin-bottom: 0.5rem;
      }

      .tech-stack { display: flex; gap: 0.35rem; flex-wrap: wrap; }

      .tech-badge {
        font-size: 0.75rem;
        padding: 0.2rem 0.6rem;
        background: var(--bg-hover);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text);
        font-family: var(--font-mono);
      }

      .modal-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }

      .modal-tag {
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
        background: var(--tag-bg);
        color: var(--tag-text);
        border-radius: 4px;
      }

      /* ========================================
         SSoC Banner
         ======================================== */
      .ssoc-banner {
        max-width: 1140px;
        margin: 0 auto 2rem;
        padding: 0 1.5rem;
      }

      .ssoc-card {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.75rem 2rem;
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .ssoc-card .ssoc-icon { font-size: 2.5rem; flex-shrink: 0; }
      .ssoc-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
      .ssoc-card p { font-size: 0.88rem; color: var(--text-muted); }
      .ssoc-card .ssoc-content { flex: 1; min-width: 200px; }

      .ssoc-points {
        display: flex;
        gap: 1rem;
        flex-shrink: 0;
      }

      .ssoc-point {
        text-align: center;
        padding: 0.5rem 1rem;
        background: var(--bg-hover);
        border-radius: var(--radius-sm);
      }

      .ssoc-point .pts { font-size: 1.2rem; font-weight: 800; color: var(--accent); }
      .ssoc-point .lbl { font-size: 0.7rem; color: var(--text-muted); }

      /* ========================================
         Footer
         ======================================== */
      .site-footer {
        text-align: center;
        padding: 2rem 1.5rem;
        border-top: 1px solid var(--border);
        color: var(--text-muted);
        font-size: 0.83rem;
      }

      .site-footer a { color: var(--text); font-weight: 600; }
      .site-footer a:hover { color: var(--accent); }
      .footer-links { display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 0.5rem; }

      /* ========================================
         Responsive
         ======================================== */
      @media (max-width: 768px) {
        .hero { padding: 3.5rem 1.25rem 3rem; }
        .stats { gap: 1.5rem; }
        .tool-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
        .modal { margin-top: 0; border-radius: var(--radius) var(--radius) 0 0; }
        .nav-links a.hide-mobile { display: none; }
        .ssoc-card { flex-direction: column; text-align: center; }
        .ssoc-points { justify-content: center; }
      }

      @media (max-width: 480px) {
        .tool-grid { grid-template-columns: 1fr; }
        .tool-card-thumb, .tool-card-thumb-placeholder { height: 150px; }
        .modal-thumb, .modal-thumb-placeholder { height: 160px; }
      }
    </style>
  </head>
  <body>
    <!-- Nav -->
    <nav class="nav">
      <a href="/" class="nav-brand">\uD83D\uDEE0\uFE0F One File Tools</a>
      <div class="nav-links">
        <a href="${escapeHtml(site.github)}" class="hide-mobile">GitHub</a>
        <a href="Contributing.md">Contribute</a>
        <a href="${escapeHtml(site.ssoc.url)}">SSoC</a>
        <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme" aria-label="Toggle dark/light theme">
          <span id="theme-icon">&#9790;</span>
        </button>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <h1>One tool. <span class="gradient">One file.</span><br>Open and use.</h1>
        <p>${escapeHtml(site.description)}</p>
        <div class="hero-buttons">
          <a href="#tools" class="btn btn-primary">Browse Tools</a>
          <a href="${escapeHtml(site.github)}" class="btn btn-ghost">GitHub</a>
          <a href="Contributing.md" class="btn btn-ghost">Contribute</a>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${totalToolCount}+</div>
        <div class="stat-label">Tool Ideas</div>
      </div>
      <div class="stat">
        <div class="stat-num">${categories.length}</div>
        <div class="stat-label">Categories</div>
      </div>
      <div class="stat">
        <div class="stat-num">${liveToolCount}</div>
        <div class="stat-label">Live Tools</div>
      </div>
      <div class="stat">
        <div class="stat-num">0</div>
        <div class="stat-label">Dependencies</div>
      </div>
    </div>

    <!-- SSoC Banner -->
    <div class="ssoc-banner">
      <div class="ssoc-card">
        <div class="ssoc-icon">\uD83C\uDF93</div>
        <div class="ssoc-content">
          <h3>Social Summer of Code</h3>
          <p>This project is part of <a href="${escapeHtml(site.ssoc.url)}">SSoC</a>. Pick an issue, build a tool in a single HTML file, submit a PR, and earn points on the <a href="${escapeHtml(site.ssoc.leaderboard)}">leaderboard</a>.</p>
        </div>
        <div class="ssoc-points">
          <div class="ssoc-point">
            <div class="pts">20</div>
            <div class="lbl">Easy</div>
          </div>
          <div class="ssoc-point">
            <div class="pts">30</div>
            <div class="lbl">Medium</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Search & Filters -->
    <div id="tools" class="controls">
      <div class="search-bar">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round"/></svg>
        <input type="text" id="search-input" placeholder="Search tools..." autocomplete="off" />
      </div>
      <div class="filters" id="filter-buttons">
        <button class="filter-btn active" data-category="all">All</button>
${categories.map((c) => `        <button class="filter-btn" data-category="${escapeHtml(c.id)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</button>`).join("\n")}
      </div>
      <div class="results-count" id="results-count"></div>
    </div>

    <!-- Tool Grid -->
    <div class="grid-container">
      <div class="tool-grid" id="tool-grid">
${toolsForEmbed
  .map(
    (t) => `        <div class="tool-card" data-id="${escapeHtml(t.id)}" data-category="${escapeHtml(t.category)}" data-search="${escapeHtml((t.name + " " + t.shortDescription + " " + t.tags.join(" ")).toLowerCase())}">
          ${t.hasThumbnail ? `<img class="tool-card-thumb" src="${escapeHtml(t.thumbnail)}" alt="${escapeHtml(t.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'tool-card-thumb-placeholder\\'>${escapeHtml(t.categoryIcon)}</div>'" />` : `<div class="tool-card-thumb-placeholder">${t.categoryIcon}</div>`}
          <div class="tool-card-body">
            <h3>${escapeHtml(t.name)}</h3>
            <p>${escapeHtml(t.shortDescription)}</p>
            <div class="tool-card-tags">
              <span class="tag tag-category">${escapeHtml(t.categoryName)}</span>
              <span class="tag tag-${t.difficulty.toLowerCase()}">${escapeHtml(t.difficulty)}</span>
              <span class="tag tag-${t.status}">${t.status === "live" ? "Live" : t.status === "in-progress" ? "In Progress" : "Idea"}</span>
            </div>
          </div>
        </div>`
  )
  .join("\n")}
      </div>
      <div class="no-results" id="no-results">No tools found matching your search.</div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal" id="modal">
        <div id="modal-content"></div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="site-footer">
      <div class="footer-links">
        <a href="${escapeHtml(site.github)}">GitHub</a>
        <a href="Contributing.md">Contributing</a>
        <a href="${escapeHtml(site.ssoc.url)}">SSoC</a>
        <a href="${escapeHtml(site.ssoc.leaderboard)}">Leaderboard</a>
      </div>
      <p>Built by <a href="${escapeHtml(site.author.url)}">${escapeHtml(site.author.name)}</a>. Open source with purpose, one file at a time.</p>
    </footer>

    <script>
      // ── Tool Data ──
      var TOOLS = ${JSON.stringify(toolsForEmbed)};

      // ── Theme ──
      function toggleTheme() {
        var html = document.documentElement;
        var isDark = html.getAttribute("data-theme") === "dark";
        html.setAttribute("data-theme", isDark ? "light" : "dark");
        document.getElementById("theme-icon").innerHTML = isDark ? "\\u263E" : "\\u2600";
        localStorage.setItem("theme", isDark ? "light" : "dark");
      }

      (function initTheme() {
        var saved = localStorage.getItem("theme");
        if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
          document.documentElement.setAttribute("data-theme", "dark");
          document.getElementById("theme-icon").innerHTML = "\\u2600";
        }
      })();

      // ── Search & Filter ──
      var searchInput = document.getElementById("search-input");
      var grid = document.getElementById("tool-grid");
      var cards = Array.from(grid.querySelectorAll(".tool-card"));
      var filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
      var noResults = document.getElementById("no-results");
      var resultsCount = document.getElementById("results-count");
      var activeCategory = "all";

      function filterAndSearch() {
        var query = searchInput.value.toLowerCase().trim();
        var visible = 0;

        cards.forEach(function(card) {
          var matchCategory = activeCategory === "all" || card.dataset.category === activeCategory;
          var matchSearch = !query || card.dataset.search.indexOf(query) !== -1;
          var show = matchCategory && matchSearch;
          card.style.display = show ? "" : "none";
          if (show) visible++;
        });

        noResults.style.display = visible === 0 ? "block" : "none";
        resultsCount.textContent = query || activeCategory !== "all"
          ? visible + " tool" + (visible !== 1 ? "s" : "") + " found"
          : "";
      }

      searchInput.addEventListener("input", filterAndSearch);

      filterButtons.forEach(function(btn) {
        btn.addEventListener("click", function() {
          filterButtons.forEach(function(b) { b.classList.remove("active"); });
          btn.classList.add("active");
          activeCategory = btn.dataset.category;
          filterAndSearch();
        });
      });

      // ── Modal ──
      var overlay = document.getElementById("modal-overlay");
      var modalContent = document.getElementById("modal-content");

      function openModal(toolId) {
        var tool = TOOLS.find(function(t) { return t.id === toolId; });
        if (!tool) return;

        var thumbHtml = tool.hasThumbnail
          ? '<img class="modal-thumb" src="' + tool.thumbnail + '" alt="' + tool.name + '" onerror="this.outerHTML=\\'<div class=modal-thumb-placeholder>' + tool.categoryIcon + '</div>\\'" />'
          : '<div class="modal-thumb-placeholder">' + tool.categoryIcon + '</div>';

        var linksHtml = '';
        if (tool.status === "live") {
          linksHtml += '<a href="' + tool.live + '" class="btn btn-primary" target="_blank">Open Tool</a>';
        }
        linksHtml += '<a href="' + tool.github + '" class="btn btn-outline" target="_blank">View Source</a>';

        var techHtml = tool.techStack.map(function(t) {
          return '<span class="tech-badge">' + t + '</span>';
        }).join("");

        var tagsHtml = tool.tags.map(function(t) {
          return '<span class="modal-tag">' + t + '</span>';
        }).join("");

        modalContent.innerHTML = thumbHtml
          + '<div class="modal-header">'
          + '  <h2>' + tool.name + '</h2>'
          + '  <button class="modal-close" onclick="closeModal()" aria-label="Close">&times;</button>'
          + '</div>'
          + '<div class="modal-meta">'
          + '  <span class="tag tag-category">' + tool.categoryName + '</span>'
          + '  <span class="tag tag-' + tool.difficulty.toLowerCase() + '">' + tool.difficulty + '</span>'
          + '  <span class="tag tag-' + tool.status + '">' + (tool.status === "live" ? "Live" : tool.status === "in-progress" ? "In Progress" : "Idea") + '</span>'
          + '</div>'
          + '<div class="modal-links">' + linksHtml + '</div>'
          + '<div class="modal-body">' + tool.longDescriptionHtml + '</div>'
          + '<div class="modal-section">'
          + '  <div class="modal-section-title">Tech Stack</div>'
          + '  <div class="tech-stack">' + techHtml + '</div>'
          + '</div>'
          + '<div class="modal-section">'
          + '  <div class="modal-section-title">Tags</div>'
          + '  <div class="modal-tags">' + tagsHtml + '</div>'
          + '</div>';

        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
      }

      function closeModal() {
        overlay.classList.remove("open");
        document.body.style.overflow = "";
      }

      // Click card to open modal
      cards.forEach(function(card) {
        card.addEventListener("click", function() {
          openModal(card.dataset.id);
        });
      });

      // Close on overlay click
      overlay.addEventListener("click", function(e) {
        if (e.target === overlay) closeModal();
      });

      // Close on Escape
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") closeModal();
      });
    </script>
  </body>
</html>`;

// ──────────────────────────────────────────────
// Write output
// ──────────────────────────────────────────────

const outPath = path.join(__dirname, "index.html");
fs.writeFileSync(outPath, html, "utf-8");

const toolCount = tools.length;
const catCount = categories.length;
const liveCount = tools.filter((t) => t.status === "live").length;
console.log(`Built index.html successfully.`);
console.log(`  ${toolCount} tools across ${catCount} categories (${liveCount} live, ${toolCount - liveCount} ideas)`);
console.log(`  Output: ${outPath}`);
