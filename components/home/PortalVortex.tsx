'use client';

import { OrthographicCamera, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hover treatment on the tile posters.
 * 'ascii'  faint white characters rain down the poster, matrix style but pale and see-through.
 * 'bubble' a perfectly round glass bubble follows the cursor, refracting the poster with a bright,
 *          color-split rim.
 * 'gel'    pixels near the cursor bulge, drag with a springy lag, and wobble a little.
 * 'ripple' the original expanding rings, now much gentler.
 */
const HOVER_EFFECT = 'ascii' as 'ascii' | 'bubble' | 'gel' | 'ripple';

/* ---------------------------------- ascii --------------------------------- */

/** Characters in the rain. Keep them plain ASCII. */
const ASCII_CHARS = '01<>/|+=-:*#%$&';
/** Number of character columns across the tile. More is finer and smaller. */
const ASCII_COLUMNS = 26;
/** Peak opacity of the white characters, 0 to 1. */
const ASCII_OPACITY = 0.5;
/** Fall speed in tile heights per second. Each column varies around it. */
const ASCII_SPEED = 0.32;
/** Length of each trail, in tile heights. */
const ASCII_TRAIL = 0.42;
/** How often characters change, per second. */
const ASCII_FLICKER = 3.0;
/** Darkening of the poster while the rain runs, so the characters read. 0 is none. */
const ASCII_DIM = 0.14;
/** Extra brightness near the cursor. 0 makes the rain even across the poster. */
const ASCII_CURSOR_BOOST = 0.6;

let glyphAtlas: THREE.CanvasTexture | null = null;
/** One row of white characters on a transparent canvas, shared by every tile. */
function getGlyphAtlas() {
  if (glyphAtlas) return glyphAtlas;
  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * ASCII_CHARS.length;
  canvas.height = cell;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(cell * 0.72)}px ui-monospace, Menlo, Consolas, "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < ASCII_CHARS.length; i++) {
      ctx.fillText(ASCII_CHARS[i], i * cell + cell / 2, cell / 2 + cell * 0.04);
    }
  }
  glyphAtlas = new THREE.CanvasTexture(canvas);
  glyphAtlas.generateMipmaps = true;
  glyphAtlas.minFilter = THREE.LinearMipmapLinearFilter;
  glyphAtlas.magFilter = THREE.LinearFilter;
  return glyphAtlas;
}

/* --------------------------------- bubble -------------------------------- */

/** Bubble radius in tile widths. 0.2 is a bubble about 40% as wide as the poster. */
const BUBBLE_RADIUS = 0.2;
/** How hard the poster is magnified and bent inside the bubble. 0 is clear flat glass. */
const BUBBLE_REFRACTION = 0.42;
/** Red/blue split toward the rim, in tile widths. 0 turns it off. */
const BUBBLE_FRINGE = 0.022;
/** Brightness of the pale blue-white rim light. */
const BUBBLE_RIM = 0.75;
/** How much the soap-film rainbow shows in the rim. 0 is plain white-blue. */
const BUBBLE_IRIDESCENCE = 0.35;
/** Darkening of the poster inside the bubble, for the glassy look. 0 is none. */
const BUBBLE_TINT = 0.22;
/** Brightness of the small window reflection. */
const BUBBLE_GLINT = 0.5;

/* ---------------------------------- gel ---------------------------------- */

/** Radius of the cursor's influence, in uv units. Larger feels like a bigger, softer finger. */
const GEL_RADIUS = 0.22;
/** How far pixels bulge away from the cursor. About 0.12 is a shift of a few pixels. */
const GEL_BULGE = 0.12;
/** How strongly the gel is pulled along with the cursor's motion. */
const GEL_DRAG = 0.26;
/** Largest lag between cursor and gel, in uv units. Keeps fast flicks from tearing the image. */
const GEL_MAX_LAG = 0.08;
/** Slow organic wobble inside the cursor's reach. */
const GEL_WOBBLE = 0.035;
/** Faint wobble across the whole tile so it never feels frozen. */
const GEL_AMBIENT = 0.0025;
/** Color split on the displaced pixels. 0 turns it off. */
const GEL_FRINGE = 0.1;
/** Extra red/blue split concentrated on the rim of the bulge, in tile widths. 0 turns it off. */
const GEL_EDGE_FRINGE = 0.014;
/** Soft lift where the gel is pressed. 0 turns it off. */
const GEL_GLOSS = 0.025;
/** Spring stiffness and damping. Lower damping gives more bounce. */
const GEL_STIFFNESS = 120;
const GEL_DAMPING = 12;
/** Fade in and out speed, per second. */
const GEL_IN = 4.5;
const GEL_OUT = 3.2;

/* --------------------------------- ripple -------------------------------- */

const DURATION = 3.0; // seconds for one wave to reach the rim
const INTERVAL = 1.1; // calm pause between waves
const RINGS = Math.ceil(DURATION / INTERVAL) + 1;
/** Overall strength of the ripple. The original was 0.7. */
const RIPPLE_STRENGTH = 0.38;
/** Brightness added along the wave. The original was 8. */
const RIPPLE_SHADING = 2.5;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const gelFragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uPointer;   // spring-smoothed cursor, in uv
uniform vec2 uLag;       // how far the gel trails the cursor, in uv
uniform float uStrength; // 0 to 1, eased in and out with hover
uniform float uTime;
varying vec2 vUv;

const float RADIUS = ${GEL_RADIUS.toFixed(4)};
const float BULGE = ${GEL_BULGE.toFixed(4)};
const float DRAG = ${GEL_DRAG.toFixed(4)};
const float WOBBLE = ${GEL_WOBBLE.toFixed(4)};
const float AMBIENT = ${GEL_AMBIENT.toFixed(4)};
const float FRINGE = ${GEL_FRINGE.toFixed(4)};
const float EDGE_FRINGE = ${GEL_EDGE_FRINGE.toFixed(4)};
const float GLOSS = ${GEL_GLOSS.toFixed(4)};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 p = vUv - uPointer;
  float falloff = exp(-dot(p, p) / (2.0 * RADIUS * RADIUS));

  // Pressing a finger into gel: sample toward the cursor so the middle swells outward.
  vec2 offset = -p * falloff * BULGE;

  // The gel trails the cursor and catches up.
  offset -= uLag * falloff * DRAG;

  // A slow, organic wobble inside the cursor's reach, plus a trace of it everywhere.
  vec2 w = vec2(
    noise(vUv * 3.5 + vec2(uTime * 0.35, 0.0)),
    noise(vUv * 3.5 + vec2(9.1, uTime * 0.3))
  ) - 0.5;
  offset += w * (falloff * WOBBLE + AMBIENT);

  offset *= uStrength;

  // Rim of the bulge, where the surface bends hardest: peaks at |p| = sqrt(2) * RADIUS, zero in the
  // middle and far outside. Red and blue are pushed apart radially there, like light through a lens edge.
  float x = dot(p, p) / (2.0 * RADIUS * RADIUS);
  float rim = x * exp(1.0 - x);
  vec2 radial = p / max(length(p), 0.0001);
  vec2 split = radial * rim * EDGE_FRINGE * uStrength;

  float r = texture2D(uTex, vUv + offset * (1.0 + FRINGE) + split).r;
  float g = texture2D(uTex, vUv + offset).g;
  float b = texture2D(uTex, vUv + offset * (1.0 - FRINGE) - split).b;

  vec3 col = vec3(r, g, b) + falloff * uStrength * GLOSS;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const bubbleFragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uPointer;
uniform vec2 uLag;
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;

const float RADIUS = ${BUBBLE_RADIUS.toFixed(4)};
const float REFRACTION = ${BUBBLE_REFRACTION.toFixed(4)};
const float FRINGE = ${BUBBLE_FRINGE.toFixed(4)};
const float RIM = ${BUBBLE_RIM.toFixed(4)};
const float IRIDESCENCE = ${BUBBLE_IRIDESCENCE.toFixed(4)};
const float TINT = ${BUBBLE_TINT.toFixed(4)};
const float GLINT = ${BUBBLE_GLINT.toFixed(4)};

vec3 poster(vec2 uv) {
  return texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb;
}

void main() {
  vec3 base = poster(vUv);

  // The bubble pops open with the hover, then closes the same way.
  float grow = 1.0 - pow(1.0 - clamp(uStrength, 0.0, 1.0), 3.0);
  float R = RADIUS * grow;
  vec2 p = vUv - uPointer;
  float len = length(p);
  float aa = 0.0035;

  if (R < 0.004 || len > R + 0.08) {
    gl_FragColor = vec4(base, 1.0);
    #include <colorspace_fragment>
    return;
  }

  float inside = 1.0 - smoothstep(R - aa, R, len);

  // Position on a sphere: z is 1 in the middle and 0 at the rim.
  vec2 d = p / R;
  float z = sqrt(max(1.0 - dot(d, d), 0.0));
  float edge = 1.0 - z;                      // 0 in the middle, 1 at the rim
  vec2 radial = p / max(len, 0.0001);

  // Lens: magnified in the middle, pulling smoothly back to the untouched poster at the rim.
  vec2 bend = p * REFRACTION * z;
  float rimWeight = edge * edge;
  vec2 split = radial * rimWeight * FRINGE;

  vec3 col;
  col.r = poster(vUv - bend + split).r;
  col.g = poster(vUv - bend).g;
  col.b = poster(vUv - bend - split).b;

  // Glassy: a little darker, so the light on the shell stands out.
  col *= 1.0 - TINT * z;

  // Rim light: pale blue-white, with a thin soap-film rainbow riding in it.
  float fres = pow(edge, 3.0);
  float thick = edge * 2.2 + atan(d.y, d.x) * 0.16 + uTime * 0.12;
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (thick + vec3(0.0, 0.33, 0.67)));
  vec3 rimColor = mix(vec3(0.62, 0.78, 1.0), film, IRIDESCENCE);
  // The rim is brightest on the side facing the light, upper left, and dim on the far side.
  float facing = 0.55 + 0.45 * dot(radial, normalize(vec2(-0.6, 0.8)));
  col += rimColor * fres * RIM * facing;

  // Small, soft window reflection inside the upper left.
  vec2 g = (d - vec2(-0.42, 0.46)) / vec2(0.2, 0.09);
  col += vec3(0.85, 0.92, 1.0) * exp(-dot(g, g)) * GLINT * z;

  // A faint halo just outside the shell.
  float halo = exp(-max(len - R, 0.0) * 90.0) * (1.0 - inside) * 0.08 * grow;

  vec3 outCol = mix(base, col, inside) + rimColor * halo;
  gl_FragColor = vec4(outCol, 1.0);
  #include <colorspace_fragment>
}
`;

const asciiFragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform sampler2D uGlyphs;
uniform vec2 uPointer;
uniform vec2 uLag;
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;

const float COLUMNS = ${ASCII_COLUMNS.toFixed(1)};
const float OPACITY = ${ASCII_OPACITY.toFixed(4)};
const float SPEED = ${ASCII_SPEED.toFixed(4)};
const float TRAIL = ${ASCII_TRAIL.toFixed(4)};
const float FLICKER = ${ASCII_FLICKER.toFixed(4)};
const float DIM = ${ASCII_DIM.toFixed(4)};
const float BOOST = ${ASCII_CURSOR_BOOST.toFixed(4)};
const float COUNT = ${ASCII_CHARS.length.toFixed(1)};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 base = texture2D(uTex, vUv).rgb;

  vec2 cell = vUv * COLUMNS;
  float col = floor(cell.x);
  float row = floor(cell.y);
  vec2 f = fract(cell);
  float cellY = (row + 0.5) / COLUMNS;
  float span = 1.0 + TRAIL;

  // Two streaks per column at different phases, so the columns are never empty for long.
  float inten = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float live = step(0.25, hash(vec2(col, 3.1 + fi * 5.0)));
    float speed = SPEED * (0.55 + 0.9 * hash(vec2(col, 7.3)));
    float phase = fract(uTime * speed / span + hash(vec2(col, 1.7)) + fi * 0.5);
    float headY = 1.0 - phase * span;
    float d = cellY - headY;                   // positive above the head, where the trail is
    float t = clamp(d / TRAIL, 0.0, 1.0);
    float streak = d < 0.0 ? 1.0 : pow(1.0 - t, 1.7) * 0.75;
    streak *= step(-1.0 / COLUMNS, d) * step(d, TRAIL);
    inten = max(inten, streak * live);
  }

  float tick = floor(uTime * FLICKER + hash(vec2(col, row)) * 10.0);
  float idx = floor(hash(vec2(col + tick * 1.3, row)) * COUNT);
  vec2 g = vec2((idx + mix(0.08, 0.92, f.x)) / COUNT, mix(0.08, 0.92, f.y));
  float glyph = texture2D(uGlyphs, g).a;

  vec2 pd = vUv - uPointer;
  float near = exp(-dot(pd, pd) / (2.0 * 0.22 * 0.22));
  float alpha = glyph * inten * OPACITY * (1.0 + BOOST * near) * uStrength;

  vec3 col3 = base * (1.0 - DIM * uStrength);
  col3 = mix(col3, vec3(1.0), clamp(alpha, 0.0, 1.0));
  gl_FragColor = vec4(col3, 1.0);
  #include <colorspace_fragment>
}
`;

const rippleFragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uCenter;
uniform float uTime;   // seconds since hover began
uniform float uStop;   // time hover ended (1e9 while hovering, -1 when idle)
varying vec2 vUv;

const float MAX_RADIUS = 0.55;
const float SHADING = ${RIPPLE_SHADING.toFixed(3)};
const float STRENGTH = ${RIPPLE_STRENGTH.toFixed(3)};
const float DURATION = ${DURATION.toFixed(3)};
const float INTERVAL = ${INTERVAL.toFixed(3)};
const int RINGS = ${RINGS};

float waveOffset(float t, vec2 dir) {
  float width = mix(0.05, 0.14, t);
  float d = length(dir) - t * MAX_RADIUS;
  d *= 1.0 - smoothstep(0.0, width, abs(d));
  d *= smoothstep(0.0, 0.05, t);
  d *= 1.0 - smoothstep(0.75, 1.0, t);
  return d;
}

// r, g, b offsets for one ring (the chromatic split)
vec3 ringOffsets(float t, vec2 dir) {
  float tOff = 0.025 * sin(t * 3.14159);
  return vec3(waveOffset(t + tOff, dir), waveOffset(t, dir), waveOffset(t - tOff, dir));
}

void main() {
  vec2 dir = uCenter - vUv;
  float len = length(dir);
  vec2 n = len > 1e-4 ? dir / len : vec2(0.0);

  vec3 sum = vec3(0.0);
  float newest = floor(uTime / INTERVAL);
  for (int i = 0; i < RINGS; i++) {
    float k = newest - float(i);
    float born = k * INTERVAL;
    if (k < 0.0 || born > uStop) continue;
    float t = (uTime - born) / DURATION;
    if (t < 0.0 || t > 1.0) continue;
    float amp = 1.0 - 0.65 * t;          // older rings are weaker
    sum += ringOffsets(t, dir) * amp;
  }
  sum *= STRENGTH;

  float r = texture2D(uTex, vUv + n * sum.r).r;
  float g = texture2D(uTex, vUv + n * sum.g).g;
  float b = texture2D(uTex, vUv + n * sum.b).b;

  vec3 col = vec3(r, g, b) + sum.g * SHADING;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/** Last known cursor position in the page. Kept at module level so a tile can start in the right spot. */
const lastPointer = { x: -1, y: -1 };
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (event) => {
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
    },
    { passive: true },
  );
}

function FillFrame() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.left = -1;
    camera.right = 1;
    camera.top = 1;
    camera.bottom = -1;
    camera.near = 0.1;
    camera.far = 10;
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

type PortalVortexProps = {
  src: string;
  active: boolean;
  /** Ripple origin in uv space. Set when the wave starts. Ignored by the gel effect. */
  origin?: [number, number];
  onRest?: () => void;
};

export function PortalVortex({ src, active, origin = [0.5, 0.5], onRest }: PortalVortexProps) {
  const texture = useTexture(src);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const activeRef = useRef(active);
  const originRef = useRef(origin);
  const clock = useRef(0);
  const stopAt = useRef<number | null>(null);
  const running = useRef(false);
  const onRestRef = useRef(onRest);
  const strength = useRef(0);
  const target = useRef(new THREE.Vector2(0.5, 0.5));
  const pos = useRef(new THREE.Vector2(0.5, 0.5));
  const vel = useRef(new THREE.Vector2(0, 0));
  activeRef.current = active;
  originRef.current = origin;
  onRestRef.current = onRest;

  const material = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    const common = { toneMapped: false, depthTest: false, depthWrite: false, vertexShader };
    if (HOVER_EFFECT !== 'ripple') {
      return new THREE.ShaderMaterial({
        ...common,
        fragmentShader:
          HOVER_EFFECT === 'ascii'
            ? asciiFragmentShader
            : HOVER_EFFECT === 'bubble'
              ? bubbleFragmentShader
              : gelFragmentShader,
        uniforms: {
          uTex: { value: texture },
          uGlyphs: { value: HOVER_EFFECT === 'ascii' ? getGlyphAtlas() : null },
          uPointer: { value: new THREE.Vector2(0.5, 0.5) },
          uLag: { value: new THREE.Vector2(0, 0) },
          uStrength: { value: 0 },
          uTime: { value: 0 },
        },
      });
    }
    return new THREE.ShaderMaterial({
      ...common,
      fragmentShader: rippleFragmentShader,
      uniforms: {
        uTex: { value: texture },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0 },
        uStop: { value: -1 },
      },
    });
  }, [texture]);

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') invalidate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [invalidate]);

  /** Cursor position inside the tile, in uv space (origin at the lower left, like the texture). */
  const readPointer = (out: THREE.Vector2) => {
    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || lastPointer.x < 0) return false;
    out.set(
      THREE.MathUtils.clamp((lastPointer.x - rect.left) / rect.width, 0, 1),
      THREE.MathUtils.clamp(1 - (lastPointer.y - rect.top) / rect.height, 0, 1),
    );
    return true;
  };

  useFrame((_, rawDelta) => {
    const u = material.uniforms;

    if (HOVER_EFFECT !== 'ripple') {
      const dt = Math.min(rawDelta, 1 / 30);
      const isActive = activeRef.current;

      if (isActive && !running.current) {
        // Hover started: begin where the cursor already is, with no jump.
        running.current = true;
        clock.current = 0;
        if (!readPointer(target.current)) target.current.set(originRef.current[0], originRef.current[1]);
        pos.current.copy(target.current);
        vel.current.set(0, 0);
      }
      if (!running.current) return;

      if (isActive) readPointer(target.current);

      const goal = isActive ? 1 : 0;
      strength.current += (goal - strength.current) * (1 - Math.exp(-(isActive ? GEL_IN : GEL_OUT) * dt));

      // Underdamped spring: the gel overshoots a little and settles.
      vel.current.x += ((target.current.x - pos.current.x) * GEL_STIFFNESS - vel.current.x * GEL_DAMPING) * dt;
      vel.current.y += ((target.current.y - pos.current.y) * GEL_STIFFNESS - vel.current.y * GEL_DAMPING) * dt;
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;

      const lag = u.uLag.value as THREE.Vector2;
      lag.set(target.current.x - pos.current.x, target.current.y - pos.current.y);
      if (lag.length() > GEL_MAX_LAG) lag.setLength(GEL_MAX_LAG);

      clock.current += dt;
      (u.uPointer.value as THREE.Vector2).copy(pos.current);
      u.uStrength.value = strength.current;
      u.uTime.value = clock.current;

      if (!isActive && strength.current < 0.004) {
        // Eased all the way out: the tile now matches the still poster beneath it.
        running.current = false;
        strength.current = 0;
        u.uStrength.value = 0;
        onRestRef.current?.();
        return;
      }

      if (document.visibilityState === 'visible') invalidate();
      return;
    }

    // Ripple.
    const delta = Math.min(rawDelta, 0.05);

    if (activeRef.current && !running.current) {
      // hover started
      running.current = true;
      clock.current = 0;
      stopAt.current = null;
      u.uCenter.value.set(originRef.current[0], originRef.current[1]);
      u.uStop.value = 1e9;
    }
    if (!running.current) return;

    if (activeRef.current && stopAt.current !== null) {
      // re-entered before settling
      stopAt.current = null;
      u.uStop.value = 1e9;
    }

    clock.current += delta;
    u.uTime.value = clock.current;

    if (!activeRef.current && stopAt.current === null) {
      // hover ended: stop making new rings
      stopAt.current = clock.current;
      u.uStop.value = clock.current;
    }

    if (stopAt.current !== null && clock.current > stopAt.current + DURATION) {
      running.current = false; // last ring has finished
      u.uTime.value = 0;
      u.uStop.value = -1;
      onRestRef.current?.();
      return;
    }

    if (document.visibilityState === 'visible') invalidate();
  });

  return (
    <>
      <OrthographicCamera
        makeDefault
        manual
        position={[0, 0, 1]}
        left={-1}
        right={1}
        top={1}
        bottom={-1}
        near={0.1}
        far={10}
      />
      <FillFrame />
      <mesh material={material} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </>
  );
}
