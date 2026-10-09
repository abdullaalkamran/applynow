import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useNavigate } from "react-router-dom";
import { createTrafficRobot, type StudentProfile, type TrackablePlane } from "./TrafficRobot";

const GLOBE_RADIUS = 1;
const BASE = import.meta.env.BASE_URL ?? "/";

// Index 0 is the student's home (Dhaka); every other city is a study destination.
const HOME = { name: "Dhaka", lat: 23.81, lon: 90.41 };
const DESTINATIONS = [
  { name: "London", lat: 51.5, lon: -0.13, color: 0x00f5ff },
  { name: "Toronto", lat: 43.65, lon: -79.38, color: 0xff2bd6 },
  { name: "Sydney", lat: -33.87, lon: 151.21, color: 0x39ff14 },
  { name: "New York", lat: 40.71, lon: -74.0, color: 0x8a5cff },
  { name: "Berlin", lat: 52.52, lon: 13.4, color: 0xff3b6b },
  { name: "Paris", lat: 48.86, lon: 2.35, color: 0xffee00 },
  { name: "Tokyo", lat: 35.68, lon: 139.69, color: 0x00f5ff },
  { name: "Stockholm", lat: 59.33, lon: 18.07, color: 0xff2bd6 },
  { name: "Amsterdam", lat: 52.37, lon: 4.9, color: 0x39ff14 },
  { name: "Auckland", lat: -36.85, lon: 174.76, color: 0x8a5cff },
  { name: "Seoul", lat: 37.57, lon: 126.98, color: 0xff3b6b },
  { name: "Zurich", lat: 47.37, lon: 8.54, color: 0xffee00 },
  { name: "Dublin", lat: 53.35, lon: -6.26, color: 0x00f5ff },
  { name: "Rome", lat: 41.9, lon: 12.5, color: 0xff2bd6 },
  { name: "Singapore", lat: 1.35, lon: 103.82, color: 0x39ff14 },
  { name: "San Francisco", lat: 37.77, lon: -122.42, color: 0x8a5cff },
  // Australia: one per state / territory capital
  { name: "Melbourne", lat: -37.81, lon: 144.96, color: 0xff3b6b },
  { name: "Brisbane", lat: -27.47, lon: 153.03, color: 0xffee00 },
  { name: "Perth", lat: -31.95, lon: 115.86, color: 0x00f5ff },
  { name: "Adelaide", lat: -34.93, lon: 138.6, color: 0xff2bd6 },
  { name: "Canberra", lat: -35.28, lon: 149.13, color: 0x39ff14 },
  { name: "Hobart", lat: -42.88, lon: 147.33, color: 0x8a5cff },
  { name: "Darwin", lat: -12.46, lon: 130.84, color: 0xff3b6b },
  // USA / Canada
  { name: "Boston", lat: 42.36, lon: -71.06, color: 0xffee00 },
  { name: "Chicago", lat: 41.88, lon: -87.63, color: 0x00f5ff },
  { name: "Los Angeles", lat: 34.05, lon: -118.24, color: 0xff2bd6 },
  { name: "Austin", lat: 30.27, lon: -97.74, color: 0x39ff14 },
  { name: "Vancouver", lat: 49.28, lon: -123.12, color: 0x8a5cff },
  { name: "Montreal", lat: 45.5, lon: -73.57, color: 0xff3b6b },
];
const HOME_COLOR = 0x00f5ff;

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D waterMap;
  uniform vec3 sunDir;
  uniform float uColor;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(sunDir);
    float ndl = dot(N, L);

    // Negative mip bias picks a sharper level of the satellite image (the source is soft), then a light
    // local-contrast lift brings coastlines and mountain ranges out.
    vec3 day = texture2D(dayMap, vUv, -0.6).rgb;
    day = clamp((day - 0.5) * 1.03 + 0.5, 0.0, 1.0);
    vec3 night = texture2D(nightMap, vUv, -0.5).rgb;
    float water = texture2D(waterMap, vUv).r;

    float dayMix = smoothstep(-0.12, 0.28, ndl);
    vec3 lit = day * (0.4 + 0.85 * max(ndl, 0.0));
    vec3 dark = day * 0.05 + night * 1.35;
    vec3 color = mix(dark, lit, dayMix);

    // Warm terminator band
    float twilight = smoothstep(-0.18, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.22, ndl));
    color += vec3(0.95, 0.45, 0.2) * twilight * 0.05;

    // Ocean sun glint
    vec3 R = reflect(-L, N);
    float spec = pow(max(dot(R, V), 0.0), 38.0) * water * dayMix;
    color += vec3(0.75, 0.88, 1.0) * spec * 0.4;

    // Fresnel rim (thin atmosphere on the lit limb)
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    color += vec3(0.28, 0.55, 1.0) * fres * 0.55 * (0.35 + dayMix);

    // Black & white at rest, full colour on hover
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 mono = vec3(pow(luma, 0.85) * 1.12);
    color = mix(mono, color, uColor);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 sunDir;
  uniform float uColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    // BackSide shell: facing ratio is ~0 at the outer silhouette and grows toward the globe,
    // so the glow is brightest hugging the surface and fades to nothing outside.
    float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
    float glow = pow(smoothstep(0.0, 0.62, facing), 2.2) * (1.0 - smoothstep(0.62, 1.0, facing));
    float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(normalize(vNormal), normalize(sunDir)));
    gl_FragColor = vec4(mix(vec3(0.82, 0.84, 0.88), vec3(0.36, 0.62, 1.0), uColor), glow * lit * 1.1);
    #include <colorspace_fragment>
  }
`;

const ROUTE_VERTEX = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ROUTE_FRAGMENT = /* glsl */ `
  uniform float uColor;
  uniform float uAlpha;
  varying vec3 vColor;
  void main() {
    vec3 mono = vec3(0.0, 0.96, 1.0); // neon cyan at rest
    gl_FragColor = vec4(mix(mono, vColor, uColor) * 1.2, uAlpha);
    #include <colorspace_fragment>
  }
`;

const STUDENT_NAMES = [
  "Tanvir Ahmed", "Nusrat Jahan", "Rafiq Hasan", "Sadia Islam", "Imran Hossain", "Farhana Akter", "Mahin Rahman",
  "Tasnim Chowdhury", "Arif Hossain", "Maliha Khan", "Shakib Hasan", "Ayesha Siddika", "Rakib Uddin", "Jannat Ara",
  "Fahim Reza", "Samia Rahman", "Nabil Karim", "Lamia Sultana", "Zubair Alam", "Mehnaz Tabassum",
];
const STUDENT_PROGRAMS = [
  "MSc Computer Science", "MBA", "BSc Data Science", "MSc Public Health", "BEng Mechanical Engineering",
  "MA International Relations", "MSc Finance", "BBA Business Analytics", "MSc Civil Engineering", "BSc Nursing",
  "MSc Artificial Intelligence", "LLM International Law",
];
const STUDENT_INTAKES = ["Jan 2027", "Feb 2027", "May 2027", "Sep 2027"];
const STUDENT_STATUSES = ["Visa approved", "Offer accepted", "Heading to campus", "Accommodation booked"];
const CITY_UNIVERSITY: Record<string, string> = {
  London: "University College London", Toronto: "University of Toronto", Sydney: "University of Sydney",
  "New York": "Columbia University", Berlin: "TU Berlin", Paris: "Sorbonne University", Tokyo: "University of Tokyo",
  Stockholm: "KTH Royal Institute", Amsterdam: "University of Amsterdam", Auckland: "University of Auckland",
  Seoul: "Seoul National University", Zurich: "ETH Zurich", Dublin: "Trinity College Dublin", Rome: "Sapienza University",
  Singapore: "National University of Singapore", "San Francisco": "San Francisco State University",
  Melbourne: "University of Melbourne", Brisbane: "University of Queensland", Perth: "University of Western Australia",
  Adelaide: "University of Adelaide", Canberra: "Australian National University", Hobart: "University of Tasmania",
  Darwin: "Charles Darwin University", Boston: "Boston University", Chicago: "University of Chicago",
  "Los Angeles": "UCLA", Austin: "UT Austin", Vancouver: "University of British Columbia", Montreal: "McGill University",
};
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Symbolic sample student: every plane in the sky stands for one student's journey. */
function makeStudent(destination: string | null): StudentProfile {
  if (!destination) {
    return {
      name: pick(STUDENT_NAMES),
      route: "No flight plan filed",
      university: "Not chosen yet",
      program: "Undecided",
      intake: "—",
      status: "Unregistered",
      warning: "Unregistered flight: no route on file",
    };
  }
  return {
    name: pick(STUDENT_NAMES),
    route: `${HOME.name} → ${destination}`,
    university: CITY_UNIVERSITY[destination] ?? `University of ${destination}`,
    program: pick(STUDENT_PROGRAMS),
    intake: pick(STUDENT_INTAKES),
    status: pick(STUDENT_STATUSES),
  };
}

function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Great-circle arc that rises smoothly off the surface and lands back on it, so it never
// dips under the globe or swings out past the horizon.
function buildArc(from: THREE.Vector3, to: THREE.Vector3): THREE.Curve<THREE.Vector3> {
  const a = from.clone().normalize();
  const b = to.clone().normalize();
  const angle = a.angleTo(b);
  const sinAngle = Math.sin(angle) || 1;
  const lift = Math.min(0.035 + angle * 0.06, 0.15);
  const points: THREE.Vector3[] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const direction = a
      .clone()
      .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
      .add(b.clone().multiplyScalar(Math.sin(t * angle) / sinAngle));
    points.push(direction.multiplyScalar(GLOBE_RADIUS + 0.004 + lift * Math.sin(Math.PI * t)));
  }
  return new THREE.CatmullRomCurve3(points);
}

// Folded paper dart: nose along +Z, wings angled up from a centre keel fold, shaded per face.
function buildPaperPlaneGeometry() {
  const nose = [0, 0.02, 1];
  const keelTail = [0, -0.2, -0.75];
  const tipL = [-0.62, 0.1, -0.75];
  const tipR = [0.62, 0.1, -0.75];
  const foldL = [-0.26, 0.0, -0.75];
  const foldR = [0.26, 0.0, -0.75];
  const topTail = [0, 0.06, -0.75];
  const faces: Array<[number[], number[], number[], number]> = [
    [nose, tipL, foldL, 0xeef2f9], // left outer wing
    [nose, foldL, keelTail, 0xa9b4c9], // left inner (shadowed) panel
    [nose, tipR, foldR, 0xdde3ef], // right outer wing
    [nose, foldR, keelTail, 0x94a0b8], // right inner (shadowed) panel
    [nose, foldL, topTail, 0xc9d1e1], // upper fold, left
    [nose, topTail, foldR, 0xbac3d6], // upper fold, right
  ];
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  faces.forEach(([a, b, c, hex]) => {
    positions.push(...a, ...b, ...c);
    color.setHex(hex);
    for (let i = 0; i < 3; i += 1) colors.push(color.r, color.g, color.b);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function rotationYForLongitude(lon: number) {
  return -THREE.MathUtils.degToRad(lon + 90);
}

export default function RealGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const goToLoginRef = useRef(() => navigate("/login"));
  goToLoginRef.current = () => navigate("/login");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
    } catch {
      return; // WebGL unavailable: leave the stage empty rather than crash the page
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Always at least 1.5x (supersampled on ordinary 1x screens so edges aren't jagged) and up to a crisp 2x on retina.
    let pixelRatio = THREE.MathUtils.clamp(window.devicePixelRatio, 1.5, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.className = "globe-webgl";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 4.8);

    const sunDir = new THREE.Vector3(1.1, 0.45, 1.0).normalize();
    const colorUniform = { value: 0 }; // 0 = black & white, 1 = full colour
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };

    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const loadTexture = (file: string, srgb: boolean) => {
      const texture = loader.load(`${BASE}globe/${file}`, () => {
        loaded += 1;
        if (loaded === 3) container.classList.add("is-ready");
      });
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAniso;
      return track(texture);
    };
    let loaded = 0;

    const dayMap = loadTexture("earth-blue-marble.jpg", true);
    const nightMap = loadTexture("earth-night.jpg", true);
    const waterMap = loadTexture("earth-water.png", false);

    const group = new THREE.Group();
    group.rotation.x = 0.38;
    group.rotation.y = rotationYForLongitude(55);
    scene.add(group);

    const earthMaterial = track(
      new THREE.ShaderMaterial({
        uniforms: { dayMap: { value: dayMap }, nightMap: { value: nightMap }, waterMap: { value: waterMap }, sunDir: { value: sunDir }, uColor: colorUniform },
        vertexShader: EARTH_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
      }),
    );
    const earthGeometry = track(new THREE.SphereGeometry(GLOBE_RADIUS, 128, 96));
    group.add(new THREE.Mesh(earthGeometry, earthMaterial));

    // Atmosphere is fixed to the camera (not the spinning group) so the halo stays even.
    const atmosphereMaterial = track(
      new THREE.ShaderMaterial({
        uniforms: { sunDir: { value: sunDir }, uColor: colorUniform },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    const atmosphereGeometry = track(new THREE.SphereGeometry(GLOBE_RADIUS * 1.16, 64, 64));
    scene.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

    // Pins with pulsing rings: home in gold, destinations in their route colour
    const pinGeometry = track(new THREE.SphereGeometry(0.016, 16, 16));
    const ringGeometry = track(new THREE.RingGeometry(0.02, 0.026, 40));
    const rings: Array<{ mesh: THREE.Mesh; offset: number }> = [];
    // flash: 0..1 pulse set when a plane lands, so the pin glows in its own colour even in black & white mode
    type Landing = { flash: number; pin: THREE.Mesh; baseScale: number; burst: THREE.Mesh; burstMaterial: THREE.MeshBasicMaterial; age: number };
    const tinted: Array<{ material: THREE.MeshBasicMaterial; base: THREE.Color; landing: Landing }> = [];
    const burstGeometry = track(new THREE.RingGeometry(0.02, 0.027, 48));
    const addPin = (lat: number, lon: number, color: number, scale: number, offset: number) => {
      const position = latLonToVec3(lat, lon, GLOBE_RADIUS + 0.004);
      const pinMaterial = track(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const ringMaterial = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      const pin = new THREE.Mesh(pinGeometry, pinMaterial);
      pin.position.copy(position);
      pin.scale.setScalar(scale);
      group.add(pin);

      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(position);
      ring.lookAt(position.clone().multiplyScalar(2));
      group.add(ring);
      rings.push({ mesh: ring, offset });

      // Expanding ripple that fires on landing (always in the destination's own colour)
      const burstMaterial = track(new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      const burst = new THREE.Mesh(burstGeometry, burstMaterial);
      burst.position.copy(position);
      burst.lookAt(position.clone().multiplyScalar(2));
      burst.visible = false;
      group.add(burst);

      const landing: Landing = { flash: 0, pin, baseScale: scale, burst, burstMaterial, age: 99 };
      tinted.push({ material: pinMaterial, base: new THREE.Color(color), landing }, { material: ringMaterial, base: new THREE.Color(color), landing });
      return { position, landing };
    };

    const homePosition = addPin(HOME.lat, HOME.lon, HOME_COLOR, 1.7, 0).position;

    // Coloured gradient routes (Dhaka -> destination) with a paper plane flying each one
    const planeGeometry = track(buildPaperPlaneGeometry());
    const planeMaterial = track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const homeColor = new THREE.Color(HOME_COLOR);
    const makeRouteMaterial = (alpha: number) =>
      track(
        new THREE.ShaderMaterial({
          uniforms: { uColor: colorUniform, uAlpha: { value: alpha } },
          vertexShader: ROUTE_VERTEX,
          fragmentShader: ROUTE_FRAGMENT,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
    const routeMaterial = makeRouteMaterial(0.95); // bright thin core
    const glowMaterial = makeRouteMaterial(0.1); // soft neon halo

    // Several planes share each route; every plane has its own random speed and waits a random time between flights.
    const PLANES_PER_ROUTE = 3;
    const randomSpeed = () => 0.05 + Math.random() * 0.09;
    const flights: Array<{ plane: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; progress: number; speed: number; landing: Landing; label: string; student: StudentProfile }> = [];

    DESTINATIONS.forEach((city, index) => {
      const { position, landing } = addPin(city.lat, city.lon, city.color, 1, (index + 1) * 0.29);
      const curve = buildArc(homePosition, position);

      const end = new THREE.Color(city.color);
      const tmp = new THREE.Color();
      const addTube = (radius: number, material: THREE.ShaderMaterial) => {
        const tube = track(new THREE.TubeGeometry(curve, 128, radius, 6, false));
        const count = tube.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          const t = Math.floor(i / 7) / 128; // 6 radial segments -> 7 vertices per ring
          tmp.copy(homeColor).lerp(end, t);
          colors.set([tmp.r, tmp.g, tmp.b], i * 3);
        }
        tube.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        group.add(new THREE.Mesh(tube, material));
      };
      // Core is a true 1-device-pixel hairline (thinner tubes shimmer once they drop below a pixel)
      const linePoints = curve.getPoints(128);
      const lineGeometry = track(new THREE.BufferGeometry().setFromPoints(linePoints));
      const lineColors = new Float32Array(linePoints.length * 3);
      linePoints.forEach((_, i) => {
        tmp.copy(homeColor).lerp(end, i / (linePoints.length - 1));
        lineColors.set([tmp.r, tmp.g, tmp.b], i * 3);
      });
      lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
      group.add(new THREE.Line(lineGeometry, routeMaterial));
      addTube(0.0016, glowMaterial);

      for (let n = 0; n < PLANES_PER_ROUTE; n += 1) {
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.scale.setScalar(0);
        group.add(plane);
        // Negative progress = still waiting on the ground
        flights.push({ plane, curve, progress: Math.random() * 1.4 - 0.4, speed: randomSpeed(), landing, label: `${HOME.name} → ${city.name}`, student: makeStudent(city.name) });
      }
    });

    // Roaming planes: never land, just circle the planet on their own random great-circle orbits
    const ROAMERS = 32;
    const roamers = Array.from({ length: ROAMERS }, () => {
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.scale.setScalar(0.017 + Math.random() * 0.009);
      scene.add(plane);
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const start = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      start.sub(axis.clone().multiplyScalar(start.dot(axis))).normalize(); // keep it on the orbit plane
      return {
        plane,
        label: "",
        student: makeStudent(null),
        axis,
        start,
        side: new THREE.Vector3().crossVectors(axis, start),
        angle: Math.random() * Math.PI * 2,
        speed: (0.12 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1),
        altitude: 0.03 + Math.random() * 0.09,
        phase: Math.random() * Math.PI * 2,
      };
    });

    roamers.forEach((roamer, i) => {
      roamer.label = `Free flight R-${String(i + 1).padStart(2, "0")}`;
    });

    // AI traffic-control robot that watches every plane
    const trackable: TrackablePlane[] = [
      ...flights.map((flight) => ({
        object: flight.plane,
        label: flight.label,
        student: flight.student,
        isActive: () => flight.progress > 0.04 && flight.progress < 0.96,
      })),
      ...roamers.map((roamer) => ({ object: roamer.plane, label: roamer.label, student: roamer.student, isActive: () => true })),
    ];
    const robot = createTrafficRobot({ scene, camera, container, planes: trackable, onStart: () => goToLoginRef.current() });

    // Drag to rotate with inertia
    const canvas = renderer.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velocityY = 0;
    const AUTO_SPEED = reducedMotion ? 0 : 0.0016;

    let hovering = false;
    const onPointerEnter = (event: PointerEvent) => {
      hovering = true;
      robot.setPointer(event.clientX, event.clientY);
    };
    const onPointerLeave = () => {
      if (!dragging) hovering = false;
      robot.setPointer(null);
    };
    let robotPress: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      robot.setPointer(event.clientX, event.clientY);
      if (robot.hitTest(event.clientX, event.clientY)) {
        // Pressing the robot opens its help bubble instead of spinning the globe
        robotPress = { x: event.clientX, y: event.clientY };
        hovering = true;
        return;
      }
      hovering = true;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      robot.setPointer(event.clientX, event.clientY);
      if (!dragging) {
        if (event.pointerType === "mouse") canvas.style.cursor = robot.hitTest(event.clientX, event.clientY) ? "pointer" : "grab";
        return;
      }
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      velocityY = dx * 0.006;
      group.rotation.y += velocityY;
      group.rotation.x = THREE.MathUtils.clamp(group.rotation.x + dy * 0.004, -0.6, 1.0);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") robot.setPointer(null); // a lifted finger is not a cursor
      if (robotPress) {
        const moved = Math.hypot(event.clientX - robotPress.x, event.clientY - robotPress.y);
        robotPress = null;
        if (moved < 10 && event.type === "pointerup") robot.toggleHelp();
        if (event.pointerType !== "mouse") hovering = false;
        return;
      }
      dragging = false;
      if (event.pointerType !== "mouse") hovering = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = "grab";
    };
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Animation loop (paused while off-screen or tab hidden)
    let frame = 0;
    let visible = true;
    const clock = new THREE.Clock();
    let lastT = 0;

    // Scratch objects reused every frame (avoids hundreds of short-lived allocations that keep the GC busy)
    const sPos = new THREE.Vector3();
    const sForward = new THREE.Vector3();
    const sUp = new THREE.Vector3();
    const sRight = new THREE.Vector3();
    const sTrueUp = new THREE.Vector3();
    const sMatrix = new THREE.Matrix4();
    const landings = Array.from(new Set(tinted.map((entry) => entry.landing)));

    const renderFrame = () => {
      const t = clock.getElapsedTime();
      const dt = Math.min(t - lastT, 0.05);
      lastT = t;
      if (!dragging) {
        velocityY *= 0.94;
        group.rotation.y += AUTO_SPEED + velocityY;
      }

      colorUniform.value += ((hovering || dragging ? 1 : 0) - colorUniform.value) * 0.08;
      landings.forEach((landing) => {
        landing.flash = Math.max(0, landing.flash - dt * 0.7);
      });
      tinted.forEach(({ material, base, landing }) => {
        material.color.setRGB(1, 1, 1).lerp(base, Math.max(colorUniform.value, landing.flash));
      });
      landings.forEach((landing) => {
        landing.age += dt;
        const life = 1.2;
        const active = landing.age < life;
        landing.burst.visible = active;
        if (active) {
          const k = landing.age / life;
          landing.burst.scale.setScalar(1 + k * 7);
          landing.burstMaterial.opacity = (1 - k) * (1 - k) * 0.95;
        }
        landing.pin.scale.setScalar(landing.baseScale * (1 + landing.flash * 0.9)); // pop on arrival
      });

      rings.forEach(({ mesh, offset }) => {
        const p = (t * 0.5 + offset) % 1;
        mesh.scale.setScalar(1 + p * 3.2);
        (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.75;
      });
      flights.forEach((flight) => {
        flight.progress += dt * flight.speed;
        if (flight.progress >= 1) {
          flight.landing.flash = 1; // touchdown: pin lights up in colour and a ripple spreads
          flight.landing.age = 0;
          flight.progress = -Math.random() * 0.9; // random pause before the next take-off
          flight.speed = randomSpeed();
        }
        const { plane, curve, progress: u } = flight;
        if (u <= 0) {
          plane.visible = false;
          return;
        }
        plane.visible = true;
        curve.getPoint(u, sPos);
        curve.getTangent(u, sForward);
        sUp.copy(sPos).normalize();
        sRight.crossVectors(sUp, sForward).normalize();
        sTrueUp.crossVectors(sForward, sRight);
        plane.position.copy(sPos);
        plane.quaternion.setFromRotationMatrix(sMatrix.makeBasis(sRight, sTrueUp, sForward));
        // Bank gently into the flight and ease the plane in/out at the ends
        plane.rotateZ(Math.sin(u * Math.PI * 2) * 0.25);
        plane.scale.setScalar(0.026 * Math.min(1, u * 8, (1 - u) * 8));
      });

      roamers.forEach((roamer) => {
        roamer.angle += dt * roamer.speed;
        const cos = Math.cos(roamer.angle);
        const sin = Math.sin(roamer.angle);
        sUp.copy(roamer.start).multiplyScalar(cos).addScaledVector(roamer.side, sin); // direction from the centre
        sForward.copy(roamer.start).multiplyScalar(-sin).addScaledVector(roamer.side, cos).multiplyScalar(Math.sign(roamer.speed));
        sRight.crossVectors(sUp, sForward).normalize();
        sTrueUp.crossVectors(sForward, sRight);
        roamer.plane.position.copy(sUp).multiplyScalar(GLOBE_RADIUS + roamer.altitude + Math.sin(t * 0.8 + roamer.phase) * 0.008);
        roamer.plane.quaternion.setFromRotationMatrix(sMatrix.makeBasis(sRight, sTrueUp, sForward));
        roamer.plane.rotateZ(Math.sin(t * 0.6 + roamer.phase) * 0.3);
        roamer.plane.rotateX(Math.sin(t * 1.3 + roamer.phase) * 0.06); // slight pitch weave
      });

      robot.update(t, dt);
      renderer.render(scene, camera);
      robot.render(renderer);
    };

    // Frame pacing: a 120Hz display would otherwise render twice as many frames for no benefit.
    // Full 60fps only while someone is interacting with the globe; a calm 30fps the rest of the time,
    // which roughly halves the GPU/CPU work (and the heat) of the idle hero.
    let lastFrameAt = 0;
    let windowStart = 0;
    let windowFrames = 0;
    let slowWindows = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const interactive = hovering || dragging;
      const target = interactive ? 60 : 30;
      if (now - lastFrameAt < 1000 / target - 2) return;
      lastFrameAt = now;
      if (!windowStart) windowStart = now;

      renderFrame();

      // Resolution safety net, judged on the real frame rate (not CPU time): if we render well below the
      // target for several seconds in a row, the machine is struggling, so step the resolution down one notch.
      windowFrames += 1;
      if (now - windowStart >= 3000) {
        const fps = (windowFrames * 1000) / (now - windowStart);
        const lagging = fps < target * 0.55 && !document.hidden;
        slowWindows = lagging ? slowWindows + 1 : 0;
        if (slowWindows >= 2 && pixelRatio > 1) {
          pixelRatio = pixelRatio > 1.5 ? 1.5 : 1;
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(container.clientWidth, container.clientHeight);
          slowWindows = 0;
        }
        windowStart = now;
        windowFrames = 0;
      }
    };
    const start = () => {
      if (!frame && visible && !document.hidden) {
        windowStart = 0; // a pause (hidden tab / scrolled away) must not count as "slow"
        windowFrames = 0;
        slowWindows = 0;
        frame = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    observer.observe(container);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      robot.resize();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    start();

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      robot.dispose();
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className="globe-canvas" role="img" aria-label="Interactive 3D globe showing study destinations. Drag to rotate." />;
}
