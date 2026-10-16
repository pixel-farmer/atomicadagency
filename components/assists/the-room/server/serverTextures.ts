import * as THREE from 'three';
import { PALETTE } from '@/components/assists/the-room/server/serverRoomConfig';

/**
 * Every surface texture in the room is painted on a 2D canvas at load time, SL style:
 * small, flat, and atlas-friendly. Swap any of these for a baked image later.
 */
export const MONO_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const POSTER_FONT = '"Arial Black", "Helvetica Neue", Impact, sans-serif';

export type CanvasTex = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
};

export function canvasTexture(width: number, height: number): CanvasTex {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Glossy white floor tiles with grey grout. One texture repeat covers 4 × 4 tiles. */
export function createTileTexture(metersPerRepeat: number, floorWidth: number, floorDepth: number) {
  const { ctx: g, texture } = canvasTexture(512, 512);
  g.fillStyle = PALETTE.grout;
  g.fillRect(0, 0, 512, 512);
  const s = 128;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = 198 + Math.floor(Math.random() * 14);
      g.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      const sheen = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
      sheen.addColorStop(0, 'rgba(255,255,255,.10)');
      sheen.addColorStop(1, 'rgba(0,0,0,.06)');
      g.fillStyle = sheen;
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
    }
  }
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(floorWidth / metersPerRepeat, floorDepth / metersPerRepeat);
  texture.anisotropy = 8;
  return texture;
}

/** Rough dark rock for the back wall. */
export function createRockTexture() {
  const { ctx: g, texture } = canvasTexture(256, 256);
  g.fillStyle = '#26272a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 20 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 2},.5)`;
    g.beginPath();
    g.ellipse(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 12, 1 + Math.random() * 5, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 2);
  return texture;
}

/** Red welcome poster with an original mascot: a cheerful CRT. */
export function createPosterTexture() {
  const tex = canvasTexture(512, 640);
  const g = tex.ctx;
  g.fillStyle = PALETTE.poster;
  g.fillRect(0, 0, 512, 640);
  const glow = g.createRadialGradient(256, 330, 40, 256, 330, 300);
  glow.addColorStop(0, 'rgba(255,190,120,.25)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 512, 640);
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.lineWidth = 10;
  g.strokeRect(16, 16, 480, 608);

  g.fillStyle = '#f2ede2';
  g.textAlign = 'center';
  g.font = `900 66px ${POSTER_FONT}`;
  g.fillText('WELCOME', 256, 112);
  g.font = `900 50px ${POSTER_FONT}`;
  g.fillText('OPERATORS', 256, 592);

  // Stand and body.
  g.fillStyle = '#1b1b1c';
  g.fillRect(226, 438, 60, 34);
  roundRect(g, 176, 466, 160, 22, 8);
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = '#1b1b1c';
  g.fillStyle = '#ece4cf';
  roundRect(g, 116, 178, 280, 266, 34);
  g.fill();
  g.stroke();
  // Screen face.
  g.fillStyle = '#1d1f20';
  roundRect(g, 146, 206, 220, 170, 26);
  g.fill();
  g.fillStyle = '#f4f2ea';
  g.beginPath();
  g.ellipse(212, 270, 22, 28, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(300, 270, 22, 28, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1d1f20';
  g.beginPath();
  g.arc(218, 278, 10, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(306, 278, 10, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = PALETTE.amber;
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(256, 312, 40, 0.25, Math.PI - 0.25);
  g.stroke();
  // Knobs and power light.
  g.fillStyle = '#1b1b1c';
  g.beginPath();
  g.arc(170, 410, 9, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(200, 410, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PALETTE.amber;
  g.fillRect(330, 404, 30, 10);
  tex.texture.needsUpdate = true;
  return tex.texture;
}

/* ------------------------------------------------------------------------------------------ */
/* Shared cabinet parts. Built once on first use and kept for the life of the page.           */
/* ------------------------------------------------------------------------------------------ */

function createVentTexture() {
  const { ctx: g, texture } = canvasTexture(256, 32);
  g.fillStyle = '#1b1c1e';
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#9a9c9f';
  for (let x = 4; x < 256; x += 6) {
    for (let y = 4; y < 32; y += 6) g.fillRect(x + ((y / 6) % 2) * 3, y, 2, 2);
  }
  return texture;
}

function createTagTexture() {
  const { ctx: g, texture } = canvasTexture(128, 44);
  g.fillStyle = PALETTE.amber;
  g.fillRect(0, 0, 128, 44);
  g.fillStyle = '#1a1208';
  g.font = `600 22px ${MONO_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('ACTIVE', 64, 23);
  return texture;
}

function createShadowTexture() {
  const { ctx: g, texture } = canvasTexture(128, 128);
  const blob = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  blob.addColorStop(0, 'rgba(0,0,0,.6)');
  blob.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = blob;
  g.fillRect(0, 0, 128, 128);
  return texture;
}

function createReelTexture() {
  const { ctx: g, texture } = canvasTexture(128, 128);
  g.fillStyle = '#2a2a2a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#4a3b2c';
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#cfd0d2';
  g.beginPath();
  g.arc(64, 64, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a2a2a';
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    g.beginPath();
    g.arc(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20, 8, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(64, 64, 5, 0, Math.PI * 2);
  g.fill();
  return texture;
}

type SharedParts = {
  materials: {
    body: THREE.MeshStandardMaterial;
    frame: THREE.MeshStandardMaterial;
    speaker: THREE.MeshStandardMaterial;
    glass: THREE.MeshStandardMaterial;
    reel: THREE.MeshStandardMaterial;
    paper: THREE.MeshStandardMaterial;
    vent: THREE.MeshBasicMaterial;
    tag: THREE.MeshBasicMaterial;
    shadow: THREE.MeshBasicMaterial;
  };
};

let shared: SharedParts | null = null;

export function getSharedParts(): SharedParts {
  if (shared) return shared;
  shared = {
    materials: {
      body: new THREE.MeshStandardMaterial({ color: PALETTE.cabinet, roughness: 0.5, metalness: 0.25 }),
      frame: new THREE.MeshStandardMaterial({ color: PALETTE.frame, roughness: 0.45 }),
      speaker: new THREE.MeshStandardMaterial({ color: PALETTE.speaker, roughness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: '#0c0d0e', roughness: 0.15, metalness: 0.6 }),
      reel: new THREE.MeshStandardMaterial({ map: createReelTexture(), roughness: 0.4, metalness: 0.3 }),
      paper: new THREE.MeshStandardMaterial({ color: '#e6e5df', roughness: 0.8 }),
      vent: new THREE.MeshBasicMaterial({ map: createVentTexture() }),
      // Slightly over 1 so the tags catch a little bloom.
      tag: new THREE.MeshBasicMaterial({ map: createTagTexture(), color: new THREE.Color(1.25, 1.25, 1.25) }),
      shadow: new THREE.MeshBasicMaterial({ map: createShadowTexture(), transparent: true, depthWrite: false }),
    },
  };
  return shared;
}
