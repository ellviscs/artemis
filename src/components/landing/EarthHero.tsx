// Landing hero: a dark, slowly rotating Earth lit by today's real NASA FIRMS fire
// detections, with a soft KARHUTLA-orange atmosphere. Loaded lazily (three.js is large).
//
// Tuning (also live via /?tune=1): SPIN is radians per second, TILT_FOLLOW how far the
// globe leans toward the pointer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

import { fetchLiveFirmsData } from '@/data/firmsApi';
import { DEFAULT_EARTH, type EarthTuning } from './earthTuning';

const RADIUS = 1;
const INDONESIA = { lat: -2, lng: 118 };

function toVec(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** Soft round sprite so fire points glow instead of drawing squares. */
function useGlowSprite(): THREE.Texture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/** Latitude/longitude lines every 15°, faint, to give the dark sphere its shape. */
function Graticule() {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const r = RADIUS * 1.001;
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lng = -180; lng < 180; lng += 3) {
        const a = toVec(lat, lng, r);
        const b = toVec(lat, lng + 3, r);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lng = -180; lng < 180; lng += 15) {
      for (let lat = -87; lat < 87; lat += 3) {
        const a = toVec(lat, lng, r);
        const b = toVec(lat + 3, lng, r);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#5a4a40" transparent opacity={0.22} />
    </lineSegments>
  );
}

const FIRE_COLORS = ['#e69430', '#d9831c', '#c67438', '#ecb067'].map((c) => new THREE.Color(c));

function FirePoints({ points }: { points: { lat: number; lng: number; frp: number }[] }) {
  const sprite = useGlowSprite();
  const { geometry, halo } = useMemo(() => {
    const pos = new Float32Array(points.length * 3);
    const col = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      const v = toVec(p.lat, p.lng, RADIUS * 1.004);
      pos.set([v.x, v.y, v.z], i * 3);
      // Brighter for stronger fires (FRP), always within the KARHUTLA oranges.
      const c = FIRE_COLORS[p.frp > 50 ? 3 : p.frp > 15 ? 0 : p.frp > 5 ? 1 : 2];
      col.set([c.r, c.g, c.b], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geometry: g, halo: g };
  }, [points]);

  return (
    <>
      <points geometry={geometry}>
        <pointsMaterial size={0.018} map={sprite} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      <points geometry={halo}>
        <pointsMaterial size={0.06} map={sprite} vertexColors transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </>
  );
}

/** Fresnel rim: the orange atmosphere glow around the limb. */
function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { glowColor: { value: new THREE.Color('#e69430') } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 glowColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            gl_FragColor = vec4(glowColor, 1.0) * intensity;
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} scale={1.18}>
      <sphereGeometry args={[RADIUS, 64, 64]} />
    </mesh>
  );
}

function Globe({ points, tuning, reducedMotion }: { points: { lat: number; lng: number; frp: number }[]; tuning: EarthTuning; reducedMotion: boolean }) {
  const spinRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const startY = useMemo(() => {
    const v = toVec(INDONESIA.lat, INDONESIA.lng, 1);
    return -Math.atan2(v.x, v.z); // face Indonesia toward the camera
  }, []);

  useFrame((state, delta) => {
    if (spinRef.current && !reducedMotion) spinRef.current.rotation.y += delta * tuning.spin;
    if (tiltRef.current) {
      // Ease toward the pointer: a small lean, never a drag.
      const tx = -state.pointer.y * tuning.tiltFollow;
      const ty = state.pointer.x * tuning.tiltFollow;
      tiltRef.current.rotation.x += (0.32 + tx - tiltRef.current.rotation.x) * Math.min(1, delta * 2.5);
      tiltRef.current.rotation.y += (ty - tiltRef.current.rotation.y) * Math.min(1, delta * 2.5);
    }
  });

  return (
    <group ref={tiltRef} rotation={[0.32, 0, 0]}>
      <group ref={spinRef} rotation={[0, startY, 0]}>
        <mesh>
          <sphereGeometry args={[RADIUS, 96, 96]} />
          <meshStandardMaterial color="#141110" roughness={0.85} metalness={0.05} emissive="#1c0f0a" emissiveIntensity={0.35} />
        </mesh>
        <Graticule />
        <FirePoints points={points} />
      </group>
      <Atmosphere />
    </group>
  );
}

export default function EarthHero({ tuning = DEFAULT_EARTH, onCount }: { tuning?: EarthTuning; onCount?: (n: number) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<{ lat: number; lng: number; frp: number }[]>([]);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    let cancelled = false;
    fetchLiveFirmsData()
      .then((d) => {
        if (cancelled) return;
        const all = [...d.viirsHotspots, ...d.modisHotspots].map((h) => ({ lat: h.lat, lng: h.lng, frp: h.frp }));
        setPoints(all);
        onCount?.(all.length);
      })
      .catch(() => !cancelled && setPoints([]));
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
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 4.3], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        // Track the pointer across the whole page, not only over the canvas.
        eventSource={document.body}
        eventPrefix="client"
        aria-hidden
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[-3, 2, 2.5]} intensity={1.1} color="#ffd9a8" />
        <pointLight position={[2.5, -1.5, -2]} intensity={6} color="#c67438" />
        <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.35} floatingRange={[-0.04, 0.04]}>
          <Globe points={points} tuning={tuning} reducedMotion={reducedMotion} />
        </Float>
      </Canvas>
    </div>
  );
}
