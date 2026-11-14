// Landing hero: Earth seen from orbit, low over the horizon. A huge sphere rises from the
// bottom of the hero and spins slowly; land is a field of fine dots (mask derived from
// NASA's public-domain Black Marble 2016), its limb glows orange, and today's real NASA
// FIRMS detections burn on it as neon squares that shed small pixel embers. The strongest
// fires get a slow ring ping. Loaded lazily (three.js is large).
//
// Stable by construction: no post-processing, fixed resolution, no depth fighting
// (overlays skip the depth test and hide the far side by angle), constant brightness for
// dots and hotspots, clamped frame delta. Everything animates on the GPU from one clock.
//
// Tuning (also live via /?tune=1): SPIN is radians per second, TILT_FOLLOW how far the
// globe leans toward the pointer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { fetchLiveFirmsData } from '@/data/firmsApi';
import { DEFAULT_EARTH, type EarthTuning } from './earthTuning';

const R = 3; // sphere radius (world units)
const CENTER_Y = -2.62; // sphere centre sits below the frame, so only the cap shows
// Tip the north away: the camera sits ~28° above the sphere centre, so a -0.42 rad tilt puts the
// equatorial belt (Indonesia, Amazon, central Africa) across the visible cap instead of the Arctic.
const TILT = -0.42;
const INDONESIA = { lat: -2, lng: 118 };
const EMBERS_PER_FIRE = 3;
const MAX_EMBER_FIRES = 1800;
const RING_FIRES = 6;

type Fire = { lat: number; lng: number; frp: number };

function toVec(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** FRP → 0..1 on a log scale (1–300 MW). */
const frpT = (frp: number) => Math.min(1, Math.max(0, Math.log10(Math.max(frp, 1)) / Math.log10(300)));

// Shared GLSL: facing factor (1 toward the camera, 0 past the limb) and snapping a clip-space
// position to a 2-px grid so squares stay crisp and read as pixels while the globe turns.
const GLSL_COMMON = `
  uniform float uPixelRatio;
  uniform vec2 uResolution;
  float facing(vec3 objPos, vec4 mv) {
    vec3 n = normalize(normalMatrix * normalize(objPos));
    return dot(n, normalize(-mv.xyz));
  }
  vec4 snapToPixels(vec4 clip, float grid) {
    vec2 ndc = clip.xy / clip.w;
    vec2 px = (ndc * 0.5 + 0.5) * uResolution;
    px = floor(px / grid) * grid + grid * 0.5;
    ndc = px / uResolution * 2.0 - 1.0;
    return vec4(ndc * clip.w, clip.z, clip.w);
  }
`;

/** Dark body with an orange fresnel limb, plus a thin outer haze. */
function Body() {
  const body = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { base: { value: new THREE.Color('#070504') }, rim: { value: new THREE.Color('#d9631c') } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 base;
          uniform vec3 rim;
          varying vec3 vNormal;
          void main() {
            float f = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.6);
            gl_FragColor = vec4(base + rim * f * 0.55, 1.0);
          }`,
      }),
    [],
  );
  const haze = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { glow: { value: new THREE.Color('#c2501a') } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 glow;
          varying vec3 vNormal;
          void main() {
            float d = max(0.0, 0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)));
            gl_FragColor = vec4(glow, 1.0) * pow(d, 2.4) * 0.5;
          }`,
      }),
    [],
  );
  return (
    <>
      <mesh material={body}>
        <sphereGeometry args={[R, 160, 160]} />
      </mesh>
      <mesh material={haze} scale={1.06}>
        <sphereGeometry args={[R, 96, 96]} />
      </mesh>
    </>
  );
}

/** Continents as fine dots, brighter toward the limb like the reference. */
function LandDots({ latlng, uniforms }: { latlng: number[]; uniforms: Record<string, THREE.IUniform> }) {
  const { geometry, material } = useMemo(() => {
    const n = latlng.length / 2;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = toVec(latlng[i * 2], latlng[i * 2 + 1], R * 1.001);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms,
      vertexShader: `
        ${GLSL_COMMON}
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float f = facing(position, mv);
          // Fade out past the limb; a little brighter near it, like light catching the edge.
          vA = smoothstep(-0.02, 0.18, f) * (0.38 + 0.4 * (1.0 - smoothstep(0.15, 0.85, f)));
          gl_PointSize = 1.8 * uPixelRatio;
          gl_Position = snapToPixels(projectionMatrix * mv, 1.0);
        }`,
      fragmentShader: `
        varying float vA;
        void main() {
          if (vA < 0.01) discard;
          gl_FragColor = vec4(vec3(0.93, 0.9, 0.86), vA);
        }`,
    });
    return { geometry: g, material: m };
  }, [latlng, uniforms]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} renderOrder={1} />;
}

/** Each fire: a neon square core (pixel-snapped), coloured by FRP. */
function FireCores({ fires, uniforms }: { fires: Fire[]; uniforms: Record<string, THREE.IUniform> }) {
  const { geometry, material } = useMemo(() => {
    const pos = new Float32Array(fires.length * 3);
    const t = new Float32Array(fires.length);
    fires.forEach((f, i) => {
      const v = toVec(f.lat, f.lng, R * 1.002);
      pos.set([v.x, v.y, v.z], i * 3);
      t[i] = frpT(f.frp);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('heat', new THREE.BufferAttribute(t, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        ${GLSL_COMMON}
        attribute float heat;
        varying float vHeat;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vA = smoothstep(0.0, 0.2, facing(position, mv));
          vHeat = heat;
          // Sprite is 3x the core so the neon glow has room; the core stays a crisp even-pixel square.
          gl_PointSize = floor((2.0 + heat * 4.0) * 0.5) * 2.0 * 3.0 * uPixelRatio * step(0.01, vA);
          gl_Position = snapToPixels(projectionMatrix * mv, 2.0);
        }`,
      fragmentShader: `
        varying float vHeat;
        varying float vA;
        vec3 ramp(float h) {
          vec3 a = vec3(1.0, 0.82, 0.35), b = vec3(1.0, 0.45, 0.1), c = vec3(1.0, 0.18, 0.3);
          return h < 0.5 ? mix(a, b, h * 2.0) : mix(b, c, (h - 0.5) * 2.0);
        }
        void main() {
          // Crisp square core (middle third of the sprite) inside a soft square neon glow.
          vec2 q = abs(gl_PointCoord - 0.5);
          float m = max(q.x, q.y);                       // square distance, 0 centre → 0.5 edge
          float core = step(m, 0.5 / 3.0);
          float hot = step(m, 0.5 / 7.0);                // brighter centre cell
          float glow = pow(1.0 - smoothstep(0.5 / 3.0, 0.5, m), 2.2) * 0.16;
          vec3 col = ramp(vHeat);
          vec3 c = col * (core * 0.72 + glow) + hot * vec3(0.22, 0.18, 0.12);
          float a = max(core, glow);
          if (a < 0.01) discard;
          gl_FragColor = vec4(c, a * vA * 0.85);
        }`,
    });
    return { geometry: g, material: m };
  }, [fires, uniforms]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} renderOrder={3} />;
}

/** Pixel embers: small neon squares that rise off the strongest fires, cool and fade. */
function Embers({ fires, uniforms }: { fires: Fire[]; uniforms: Record<string, THREE.IUniform> }) {
  const { geometry, material } = useMemo(() => {
    const src = [...fires].sort((a, b) => b.frp - a.frp).slice(0, MAX_EMBER_FIRES);
    const n = src.length * EMBERS_PER_FIRE;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 3); // phase, speed, sideways drift
    const heat = new Float32Array(n);
    let k = 0;
    src.forEach((f) => {
      const v = toVec(f.lat, f.lng, R * 1.002);
      for (let e = 0; e < EMBERS_PER_FIRE; e++, k++) {
        pos.set([v.x, v.y, v.z], k * 3);
        seed.set([(e + Math.random()) / EMBERS_PER_FIRE, 0.18 + Math.random() * 0.22, Math.random() * 6.283], k * 3);
        heat[k] = frpT(f.frp);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('heat', new THREE.BufferAttribute(heat, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        ${GLSL_COMMON}
        uniform float uTime;
        attribute vec3 seed;
        attribute float heat;
        varying float vLife;
        varying float vA;
        void main() {
          float life = fract(uTime * seed.y + seed.x);       // 0 born → 1 gone
          vec3 n = normalize(position);
          vec3 side = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + 1e-4);
          float rise = life * (0.05 + heat * 0.09);
          vec3 p = position + n * rise + side * sin(seed.z + life * 3.0) * 0.012;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float f = smoothstep(0.0, 0.2, facing(position, mv));
          vLife = life;
          vA = f * (1.0 - life) * smoothstep(0.0, 0.08, life);
          gl_PointSize = floor(mix(4.0, 2.0, life) * 0.5) * 2.0 * uPixelRatio * step(0.01, vA);
          gl_Position = snapToPixels(projectionMatrix * mv, 2.0);
        }`,
      fragmentShader: `
        varying float vLife;
        varying float vA;
        void main() {
          vec3 col = mix(vec3(1.0, 0.86, 0.4), vec3(1.0, 0.22, 0.12), vLife);
          gl_FragColor = vec4(col, vA * 0.6);
        }`,
    });
    return { geometry: g, material: m };
  }, [fires, uniforms]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} renderOrder={4} />;
}

/** Slow ring ping around the strongest fires of the day (like the reference markers). */
function Rings({ fires, uniforms }: { fires: Fire[]; uniforms: Record<string, THREE.IUniform> }) {
  const { geometry, material } = useMemo(() => {
    const top = [...fires].sort((a, b) => b.frp - a.frp).slice(0, RING_FIRES);
    const pos = new Float32Array(top.length * 3);
    const phase = new Float32Array(top.length);
    top.forEach((f, i) => {
      const v = toVec(f.lat, f.lng, R * 1.002);
      pos.set([v.x, v.y, v.z], i * 3);
      phase[i] = i / top.length;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        ${GLSL_COMMON}
        uniform float uTime;
        attribute float phase;
        varying float vT;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vA = smoothstep(0.05, 0.3, facing(position, mv));
          vT = fract(uTime * 0.28 + phase);
          gl_PointSize = 44.0 * uPixelRatio * step(0.01, vA);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vT;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float r1 = 0.28 + vT * 0.68;                       // expanding ping
          float ping = smoothstep(0.06, 0.0, abs(d - r1)) * (1.0 - vT);
          float halo = smoothstep(0.08, 0.0, abs(d - 0.36)) * 0.45; // steady ring
          gl_FragColor = vec4(vec3(1.0, 0.42, 0.12), (ping + halo) * vA);
        }`,
    });
    return { geometry: g, material: m };
  }, [fires, uniforms]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} renderOrder={5} />;
}

function Globe({ fires, land, tuning, reducedMotion }: { fires: Fire[]; land: number[]; tuning: EarthTuning; reducedMotion: boolean }) {
  const spinRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const speed = useRef(0);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 }, uResolution: { value: new THREE.Vector2(1, 1) } }),
    [],
  );
  useEffect(() => {
    uniforms.uPixelRatio.value = dpr;
    uniforms.uResolution.value.set(size.width * dpr, size.height * dpr);
  }, [uniforms, size, dpr]);

  // Start with Indonesia riding the horizon, facing the camera.
  const startY = useMemo(() => {
    const v = toVec(INDONESIA.lat, INDONESIA.lng, 1);
    return -Math.atan2(v.x, v.z);
  }, []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const k = 1 - Math.exp(-delta * 3);
    if (!reducedMotion) uniforms.uTime.value += delta;
    if (spinRef.current && !reducedMotion) {
      speed.current += (tuning.spin * 0.35 - speed.current) * k; // a big globe reads faster: slow it down
      spinRef.current.rotation.y += delta * speed.current;
    }
    if (tiltRef.current) {
      tiltRef.current.rotation.x += (TILT - state.pointer.y * tuning.tiltFollow - tiltRef.current.rotation.x) * k;
      tiltRef.current.rotation.z += (-state.pointer.x * tuning.tiltFollow * 0.5 - tiltRef.current.rotation.z) * k;
    }
  });

  return (
    <group position={[0, CENTER_Y, 0]}>
      <group ref={tiltRef} rotation={[TILT, 0, 0]}>
        <group ref={spinRef} rotation={[0, startY, 0]}>
          <Body />
          {land.length > 0 && <LandDots latlng={land} uniforms={uniforms} />}
          {fires.length > 0 && (
            <>
              <FireCores fires={fires} uniforms={uniforms} />
              <Embers fires={fires} uniforms={uniforms} />
              <Rings fires={fires} uniforms={uniforms} />
            </>
          )}
        </group>
      </group>
    </group>
  );
}

export default function EarthHero({ tuning = DEFAULT_EARTH, onCount }: { tuning?: EarthTuning; onCount?: (n: number) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fires, setFires] = useState<Fire[]>([]);
  const [land, setLand] = useState<number[]>([]);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/land-dots.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { latlng: number[] }) => !cancelled && setLand(d.latlng))
      .catch(() => undefined);
    fetchLiveFirmsData()
      .then((d) => {
        if (cancelled) return;
        const all = [...d.viirsHotspots, ...d.modisHotspots].map((h) => ({ lat: h.lat, lng: h.lng, frp: h.frp }));
        setFires(all);
        onCount?.(all.length);
      })
      .catch(() => !cancelled && setFires([]));
    return () => {
      cancelled = true;
    };
  }, [onCount]);

  // Pause rendering when the tab is hidden or the hero is scrolled off screen.
  useEffect(() => {
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === 'visible');
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    });
    if (wrapRef.current) io.observe(wrapRef.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return (
    <div ref={wrapRef} className="h-full w-full">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={Math.min(2, window.devicePixelRatio || 1)}
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        eventSource={document.body}
        eventPrefix="client"
        aria-hidden
      >
        <Globe fires={fires} land={land} tuning={tuning} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
