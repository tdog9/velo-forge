#!/usr/bin/env node
/**
 * Generate every static brand asset search engines + social previews
 * need to render TurboPrep properly:
 *
 *   • favicon.png         (32×32)   — search results, browser tabs
 *   • favicon-192.png     (192×192) — Android Chrome
 *   • icon-512.png        (512×512) — PWA install / app drawer
 *   • apple-touch-icon.png (180×180) — iOS home screen
 *   • og-image.png        (1200×630) — Open Graph card on iMessage,
 *                                      WhatsApp, Discord, Slack,
 *                                      Facebook, etc.
 *   • favicon.svg         (scalable) — modern browsers
 *
 * Brand: dark base + brand-orange T monogram + "TURBOPREP" wordmark.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.resolve(__dirname, '..');
const BG = '#0a0b0f';
const ORANGE = '#f97316';
const ORANGE_DARK = '#ea6a0a';
const WHITE = '#ffffff';
const MUTED = '#7a7d88';

// Square monogram-style SVG used for every square icon size.
function monogramSvg(size) {
  const corner = Math.round(size * 0.22);
  const tilePad = Math.round(size * 0.10);
  const tileCorner = Math.round(size * 0.15);
  const tileSize = size - tilePad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${ORANGE}"/>
        <stop offset="100%" stop-color="${ORANGE_DARK}"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${size}" height="${size}" rx="${corner}" fill="${BG}"/>
    <rect x="${tilePad}" y="${tilePad}" width="${tileSize}" height="${tileSize}" rx="${tileCorner}" fill="url(#tile)"/>
    <text x="${size / 2}" y="${size / 2}"
          font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif"
          font-size="${size * 0.48}" font-weight="900"
          text-anchor="middle" dominant-baseline="central"
          fill="${WHITE}">T</text>
  </svg>`;
}

// 1200×630 OG card — landscape, branded, with tagline. This is what
// renders when someone pastes turboprep.app into iMessage, WhatsApp,
// Slack, Discord, Facebook, LinkedIn, etc.
function ogCardSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${BG}"/>
        <stop offset="100%" stop-color="#14161c"/>
      </linearGradient>
      <radialGradient id="halo" cx="0.25" cy="0.45" r="0.5">
        <stop offset="0%" stop-color="${ORANGE}" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="${ORANGE}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${ORANGE}"/>
        <stop offset="100%" stop-color="${ORANGE_DARK}"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
    <rect x="0" y="0" width="1200" height="630" fill="url(#halo)"/>

    <!-- Brand tile + monogram -->
    <rect x="100" y="180" width="180" height="180" rx="36" fill="url(#tile)"/>
    <text x="190" y="280"
          font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif"
          font-size="120" font-weight="900"
          text-anchor="middle" dominant-baseline="central"
          fill="${WHITE}">T</text>

    <!-- Wordmark -->
    <text x="320" y="240"
          font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif"
          font-size="86" font-weight="900" letter-spacing="-2"
          fill="${WHITE}">Turbo<tspan fill="${ORANGE}">Prep</tspan></text>

    <!-- Tagline -->
    <text x="320" y="310"
          font-family="-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif"
          font-size="30" font-weight="600"
          fill="${MUTED}">HPR race-day platform · built in Melbourne</text>

    <!-- Feature row -->
    <g font-family="-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif"
       font-size="22" font-weight="700" fill="${WHITE}">
      <circle cx="120" cy="478" r="6" fill="${ORANGE}"/>
      <text x="138" y="486">Live race-day leaderboard</text>
      <circle cx="430" cy="478" r="6" fill="${ORANGE}"/>
      <text x="448" y="486">Apple Watch stint tracking</text>
      <circle cx="760" cy="478" r="6" fill="${ORANGE}"/>
      <text x="778" y="486">AI coach + week summaries</text>
    </g>

    <!-- Footer chip -->
    <rect x="100" y="540" width="240" height="40" rx="20" fill="${ORANGE}" fill-opacity="0.12" stroke="${ORANGE}" stroke-width="1.5" stroke-opacity="0.5"/>
    <text x="220" y="566"
          font-family="-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif"
          font-size="18" font-weight="800" letter-spacing="2"
          text-anchor="middle" fill="${ORANGE}">TURBOPREP.APP</text>
  </svg>`;
}

async function writePng(svg, outName, size) {
  const buf = Buffer.from(svg);
  const png = await sharp(buf).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(OUT, outName), png);
  console.log('  •', outName, '(' + size + ' bytes svg →', png.length + ' bytes png)');
}

(async () => {
  console.log('Generating brand assets in', OUT);

  // Square icons
  for (const [size, name] of [
    [32,  'favicon.png'],
    [192, 'favicon-192.png'],
    [512, 'icon-512.png'],
    [180, 'apple-touch-icon.png'],
  ]) {
    const svg = monogramSvg(size);
    await writePng(svg, name, svg.length);
  }

  // Scalable favicon
  fs.writeFileSync(path.join(OUT, 'favicon.svg'), monogramSvg(32));
  console.log('  • favicon.svg');

  // OG card (1200×630)
  const og = ogCardSvg();
  await writePng(og, 'og-image.png', og.length);

  // Twitter card uses the same image but if we ever want a square
  // variant for Mastodon / iMessage rich-preview, write it now too.
  console.log('\n✓ all brand assets written.');
  console.log('\nNext: index.html should reference these instead of JS-generated canvas data URLs.');
})();
