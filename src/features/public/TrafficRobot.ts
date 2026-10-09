import * as THREE from "three";

const CYAN = 0x00f5ff;
const GLOBE_RADIUS = 1;
const FLY_DEPTH = 1.3; // in front of the globe + atmosphere so the robot is never hidden
const TRACK_SLOTS = 4; // slot 0 is the "primary" lock the head follows; the rest are secondary scans

export type StudentProfile = {
  name: string;
  route: string;
  university: string;
  program: string;
  intake: string;
  status: string;
  /** Set for planes that are not on any filed route; the robot raises a warning when it scans one. */
  warning?: string;
};

export type TrackablePlane = {
  object: THREE.Object3D;
  label: string;
  student: StudentProfile;
  isActive: () => boolean;
};

type Options = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  planes: TrackablePlane[];
  /** Called when someone presses the call-to-action in the help bubble. */
  onStart: () => void;
};

type Slot = {
  target: TrackablePlane | null;
  nextPick: number;
  line: THREE.Line;
  positions: Float32Array;
  ring: THREE.Mesh;
  ringMaterial: THREE.MeshBasicMaterial;
};

/**
 * A floating 3D "air traffic control" robot. It hovers beside the globe, turns its head to follow one
 * plane, and fires thin scanner beams with lock-on rings at several planes at once.
 */
export function createTrafficRobot({ scene, camera, container, planes, onStart }: Options) {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  const standard = (params: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(params));
  const glow = (color: number) => track(new THREE.MeshBasicMaterial({ color }));
  const additive = (color: number, opacity: number) =>
    track(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

  const graphite = standard({ color: 0x20242c, metalness: 0.7, roughness: 0.35 });
  const silver = standard({ color: 0xe3e8f0, metalness: 0.55, roughness: 0.28 });
  const visorMaterial = standard({ color: 0x05070b, metalness: 0.9, roughness: 0.12 });
  const cyanGlow = glow(CYAN);

  // Lights only affect the robot (the globe, routes and planes use their own unlit materials)
  const ambient = new THREE.AmbientLight(0xffffff, 1.1);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(2, 3, 4);
  // The robot has its own scene, drawn after the globe with the depth buffer cleared,
  // so it can hover at the plane's depth without ever being hidden inside the globe.
  const robotScene = new THREE.Scene();
  robotScene.add(ambient, keyLight);

  const root = new THREE.Group();
  robotScene.add(root);
  const rig = new THREE.Group();
  rig.rotation.order = "YXZ"; // yaw first, then pitch, so looking sideways-and-down behaves
  root.add(rig);

  const rimLight = new THREE.PointLight(CYAN, 0.5, 4);
  rimLight.position.set(-0.6, -0.2, 0.8);
  rig.add(rimLight);

  // Generous invisible hit area so the robot is easy to click or tap
  const hitProxy = new THREE.Mesh(track(new THREE.SphereGeometry(0.95, 12, 12)), track(new THREE.MeshBasicMaterial({ visible: false })));
  hitProxy.position.y = 0.1;
  rig.add(hitProxy);

  // Body
  const body = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.2, 0.32, 8, 20)), graphite);
  body.scale.set(1, 1, 0.9);
  rig.add(body);

  const chestLight = new THREE.Mesh(track(new THREE.CircleGeometry(0.06, 24)), cyanGlow);
  chestLight.position.set(0, 0.08, 0.184);
  rig.add(chestLight);

  const belt = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.012, 8, 48)), cyanGlow);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = -0.14;
  belt.scale.set(1, 0.9, 1);
  rig.add(belt);

  // Floating arms
  const armGeometry = track(new THREE.CapsuleGeometry(0.06, 0.2, 6, 12));
  const handGeometry = track(new THREE.SphereGeometry(0.05, 14, 14));
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, -0.02, 0.05);
    arm.add(new THREE.Mesh(armGeometry, graphite));
    const hand = new THREE.Mesh(handGeometry, cyanGlow);
    hand.position.y = -0.17;
    arm.add(hand);
    rig.add(arm);
    return { arm, side };
  });

  // Head
  const head = new THREE.Group();
  head.position.y = 0.6;
  rig.add(head);

  const skull = new THREE.Mesh(track(new THREE.SphereGeometry(0.27, 40, 28)), silver);
  skull.scale.set(1, 0.86, 0.94);
  head.add(skull);

  const visor = new THREE.Mesh(track(new THREE.SphereGeometry(0.27, 32, 24)), visorMaterial);
  visor.scale.set(0.8, 0.5, 0.52);
  visor.position.set(0, 0.02, 0.17);
  head.add(visor);

  const eyeGeometry = track(new THREE.SphereGeometry(0.046, 16, 16));
  const eyes = [-1, 1].map((side) => {
    const mesh = new THREE.Mesh(eyeGeometry, cyanGlow);
    const base = new THREE.Vector3(side * 0.1, 0.03, 0.288);
    mesh.position.copy(base);
    mesh.scale.set(1, 1.1, 0.45);
    head.add(mesh);
    return { mesh, base };
  });
  const gaze = new THREE.Vector2(); // eyes slide within the visor toward whatever the robot is looking at
  let nextBlink = 2.5;
  let blinkStart = -1;

  const podGeometry = track(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 24));
  const podRingGeometry = track(new THREE.TorusGeometry(0.075, 0.01, 8, 28));
  [-1, 1].forEach((side) => {
    const pod = new THREE.Mesh(podGeometry, graphite);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(side * 0.285, 0, 0);
    head.add(pod);
    const ring = new THREE.Mesh(podRingGeometry, cyanGlow);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 0.325, 0, 0);
    head.add(ring);
  });

  const antenna = new THREE.Mesh(track(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 8)), graphite);
  antenna.position.set(0.09, 0.34, 0);
  antenna.rotation.z = -0.18;
  head.add(antenna);
  const antennaTip = new THREE.Mesh(track(new THREE.SphereGeometry(0.035, 14, 14)), cyanGlow);
  antennaTip.position.set(0.123, 0.455, 0);
  head.add(antennaTip);

  // Back of the robot (this is the side the viewer sees while it looks down at the planes)
  const pack = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.38, 0.13)), graphite);
  pack.position.set(0, 0.04, -0.22);
  rig.add(pack);
  const packStrip = new THREE.Mesh(track(new THREE.BoxGeometry(0.03, 0.26, 0.012)), cyanGlow);
  packStrip.position.set(0, 0.04, -0.292);
  rig.add(packStrip);
  [-1, 1].forEach((side) => {
    const vent = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, 0.22, 0.012)), standard({ color: 0x0b0d12, metalness: 0.6, roughness: 0.5 }));
    vent.position.set(side * 0.09, 0.04, -0.29);
    rig.add(vent);
    const nozzle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.045, 0.05, 14)), cyanGlow);
    nozzle.position.set(side * 0.09, -0.19, -0.22);
    rig.add(nozzle);
  });
  const headBackLight = new THREE.Mesh(track(new THREE.CircleGeometry(0.07, 28)), cyanGlow);
  headBackLight.rotation.y = Math.PI;
  headBackLight.position.set(0, 0.06, -0.258);
  head.add(headBackLight);
  const headBackRing = new THREE.Mesh(track(new THREE.RingGeometry(0.085, 0.098, 32)), glow(0x9defff));
  headBackRing.rotation.y = Math.PI;
  headBackRing.position.set(0, 0.06, -0.257);
  head.add(headBackRing);

  // Hover thruster + radar sweep
  const hoverRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.15, 0.012, 8, 40)), cyanGlow);
  hoverRing.rotation.x = Math.PI / 2;
  hoverRing.position.y = -0.5;
  rig.add(hoverRing);

  const thrusterMaterial = additive(CYAN, 0.22);
  const thruster = new THREE.Mesh(track(new THREE.ConeGeometry(0.13, 0.32, 28, 1, true)), thrusterMaterial);
  thruster.rotation.x = Math.PI;
  thruster.position.y = -0.68;
  rig.add(thruster);

  const waveMaterial = additive(CYAN, 0.5);
  const wave = new THREE.Mesh(track(new THREE.RingGeometry(0.34, 0.355, 64)), waveMaterial);
  wave.rotation.x = Math.PI / 2;
  wave.position.y = -0.45;
  rig.add(wave);

  // Scanner beams + lock-on rings
  const lineMaterials = [
    track(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })),
    track(new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })),
  ];
  const lockGeometry = track(new THREE.RingGeometry(0.82, 1, 40));

  // Scanner: a translucent cone from the robot's visor to the plane it is studying, with pulses running down it
  const scanConeGeometry = track(new THREE.ConeGeometry(1, 1, 28, 1, true).translate(0, -0.5, 0)); // apex at origin, opens along -Y
  const scanConeMaterial = track(
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
  );
  const scanCone = new THREE.Mesh(scanConeGeometry, scanConeMaterial);
  scanCone.visible = false;
  scene.add(scanCone);

  const pulseMaterials = [0, 1].map(() =>
    track(new THREE.MeshBasicMaterial({ color: 0x9defff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })),
  );
  const pulses = pulseMaterials.map((material) => {
    const mesh = new THREE.Mesh(lockGeometry, material);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const sweepMaterial = track(
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
  );
  const planeSweep = new THREE.Mesh(lockGeometry, sweepMaterial); // expanding scan ring on the plane itself
  planeSweep.visible = false;
  scene.add(planeSweep);
  // Normal scans are neon cyan; an unregistered (route-less) plane turns the scanner red
  const ALERT = new THREE.Color(0xff3b3b);
  const ALERT_SOFT = new THREE.Color(0xffb0b0);
  const NORMAL = new THREE.Color(CYAN);
  const NORMAL_SOFT = new THREE.Color(0x9defff);
  let alertMix = 0;
  const tintStrong = new THREE.Color();
  const tintSoft = new THREE.Color();
  const idleEuler = new THREE.Euler();
  const scanDir = new THREE.Vector3();
  const scanQuat = new THREE.Quaternion();
  const DOWN = new THREE.Vector3(0, -1, 0);
  const FORWARD = new THREE.Vector3(0, 0, 1);
  const SCAN_RADIUS = 0.07;

  const slots: Slot[] = Array.from({ length: TRACK_SLOTS }, (_, index) => {
    const positions = new Float32Array(6);
    const geometry = track(new THREE.BufferGeometry());
    const attribute = new THREE.BufferAttribute(positions, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", attribute);
    const line = new THREE.Line(geometry, lineMaterials[index === 0 ? 0 : 1]);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);

    const ringMaterial = additive(CYAN, index === 0 ? 0.95 : 0.5);
    const ring = new THREE.Mesh(lockGeometry, ringMaterial);
    ring.visible = false;
    scene.add(ring);
    return { target: null, nextPick: 0, line, positions, ring, ringMaterial };
  });

  // Scan report: transparent terminal-style readout that "types" itself as the robot scans, and travels with the robot
  const hud = document.createElement("div");
  hud.className = "globe-hud is-idle";
  container.appendChild(hud);

  type ReportLine = { label: string; value: string; tone: "dim" | "ok" | "warn" | "alert" | "plain" };
  type LineView = { el: HTMLElement; key: HTMLElement; val: HTMLElement; label: string; value: string };
  const caret = document.createElement("i");
  caret.className = "hud-caret";
  let lineViews: LineView[] = [];
  let typedChars = 0;
  let totalChars = 0;
  let renderedChars = -1;
  let typingDelay = 0;
  let shownTarget: TrackablePlane | null = null;
  let hudSize = { w: 150, h: 70 };
  const hudPos = { x: 0, y: 0 };
  let hudPlaced = false;

  const buildReport = (plane: TrackablePlane): ReportLine[] => {
    const { student } = plane;
    if (student.warning) {
      return [
        { label: "> SCAN ", value: plane.label.toUpperCase(), tone: "dim" },
        { label: "⚠ WARNING", value: "", tone: "alert" },
        { label: "", value: "UNREGISTERED FLIGHT", tone: "warn" },
        { label: "", value: "NO ROUTE ON FILE", tone: "warn" },
        { label: "NAME ", value: student.name, tone: "plain" },
        { label: "STATUS ", value: student.status, tone: "warn" },
      ];
    }
    return [
      { label: "> SCAN ", value: plane.label.toUpperCase(), tone: "dim" },
      { label: "✓ ", value: "ROUTE VERIFIED", tone: "ok" },
      { label: "NAME ", value: student.name, tone: "plain" },
      { label: "UNI ", value: student.university, tone: "plain" },
      { label: "PROG ", value: student.program, tone: "plain" },
      { label: "STATUS ", value: student.status, tone: "plain" },
    ];
  };

  const showReport = (plane: TrackablePlane | null) => {
    if (plane === shownTarget) return;
    shownTarget = plane;
    hud.classList.toggle("is-idle", !plane);
    if (!plane) return;
    hud.replaceChildren();
    lineViews = buildReport(plane).map((line) => {
      const el = document.createElement("div");
      el.className = `hud-line tone-${line.tone}`;
      el.style.visibility = "hidden"; // revealed when its first letter is typed (layout space is kept)
      const key = document.createElement("span");
      key.className = "k";
      const val = document.createElement("span");
      val.className = "v";
      el.append(key, val);
      hud.appendChild(el);
      return { el, key, val, label: line.label, value: line.value };
    });
    totalChars = lineViews.reduce((sum, line) => sum + line.label.length + line.value.length, 0);
    typedChars = 0;
    renderedChars = -1;
    typingDelay = 0.35; // a short "acquiring target" beat before the first letter
    hudSize = { w: hud.offsetWidth || 150, h: hud.offsetHeight || 70 };
  };

  /** Reveal the report letter by letter. */
  const typeReport = (dt: number) => {
    if (!shownTarget) return;
    if (typingDelay > 0) {
      typingDelay -= dt;
      return;
    }
    typedChars = Math.min(totalChars, typedChars + dt * 46);
    const count = Math.floor(typedChars);
    if (count === renderedChars) return;
    renderedChars = count;
    let remaining = count;
    let active: LineView | null = null;
    lineViews.forEach((line) => {
      const labelCount = Math.min(remaining, line.label.length);
      remaining -= labelCount;
      const valueCount = Math.min(remaining, line.value.length);
      remaining -= valueCount;
      line.key.textContent = line.label.slice(0, labelCount);
      line.val.textContent = line.value.slice(0, valueCount);
      line.el.style.visibility = labelCount + valueCount > 0 ? "visible" : "hidden";
      if (!active && (labelCount < line.label.length || valueCount < line.value.length)) active = line;
    });
    const last = lineViews[lineViews.length - 1];
    (active ?? last)?.el.appendChild(caret); // blinking caret sits on the line being typed
  };

  // Help bubble, opened by clicking / tapping the robot
  const help = document.createElement("div");
  help.className = "globe-help";
  help.setAttribute("role", "dialog");
  help.setAttribute("aria-label", "AI guide");
  help.innerHTML = `
    <button type="button" class="globe-help-close" aria-label="Close">×</button>
    <h4>Hi, I'm UniBot</h4>
    <p>I keep an eye on every student's journey from Bangladesh to campus. Here's how I can help you:</p>
    <ul>
      <li>Find universities and courses that fit your profile</li>
      <li>Check entry requirements and scholarships</li>
      <li>Plan costs, visas and deadlines</li>
      <li>Track your application, step by step</li>
    </ul>
    <button type="button" class="globe-help-cta">Sign in to get started →</button>`;
  container.appendChild(help);
  let helpOpen = false;
  let helpSize = { w: 250, h: 220 };

  const setHelp = (open: boolean) => {
    helpOpen = open;
    help.classList.toggle("is-open", open);
    hud.classList.toggle("is-hidden", open);
    if (open) helpSize = { w: help.offsetWidth, h: help.offsetHeight };
  };
  help.querySelector(".globe-help-close")?.addEventListener("click", () => setHelp(false));
  help.querySelector(".globe-help-cta")?.addEventListener("click", () => onStart());

  // Keyboard / screen-reader entry point
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "Ask the AI guide how it can help";
  trigger.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;opacity:0;";
  trigger.addEventListener("focus", () => (trigger.style.opacity = "1"));
  trigger.addEventListener("click", () => setHelp(!helpOpen));
  container.appendChild(trigger);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitTest = (clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(hitProxy, false).length > 0;
  };

  // Where the robot sits and how far it may roam (set by resize)
  const home = new THREE.Vector3();
  const view = { halfW: 1, halfH: 1, pxPerUnit: 300, globePx: 250, overhangX: 0 };
  const desired = new THREE.Vector3();
  const lastPosition = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const projected = new THREE.Vector3();

  // Scratch objects (avoid per-frame allocations)
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const eyeLocal = new THREE.Vector3(0, 0.03, 0.3);
  const headWorld = new THREE.Vector3();
  const aimer = new THREE.Object3D();
  const parentQuat = new THREE.Quaternion();
  const targetQuat = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const MAX_HEAD_TURN = 1.0; // the body already faces the plane, so the head only fine-tunes

  /** True when the globe sits between the camera and this point. */
  const isOccluded = (point: THREE.Vector3) => {
    tmpA.copy(point).sub(camera.position);
    const distance = tmpA.length();
    tmpA.divideScalar(distance);
    const b = camera.position.dot(tmpA);
    const c = camera.position.lengthSq() - (GLOBE_RADIUS * 0.985) ** 2;
    const disc = b * b - c;
    if (disc < 0) return false;
    const hit = -b - Math.sqrt(disc);
    return hit > 0 && hit < distance - 0.002;
  };

  const worldPosition = (plane: TrackablePlane, out: THREE.Vector3) => plane.object.getWorldPosition(out);
  const isTrackable = (plane: TrackablePlane) => plane.isActive() && !isOccluded(worldPosition(plane, tmpC));

  const pickTarget = (slot: Slot) => {
    const taken = new Set(slots.map((s) => s.target));
    const candidates = planes.filter((plane) => !taken.has(plane) && isTrackable(plane));
    slot.target = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  };

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const distance = camera.position.z - FLY_DEPTH;
    view.halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
    view.halfW = view.halfH * camera.aspect;
    view.pxPerUnit = height / (2 * view.halfH);
    // How far the report card may hang past the canvas's right edge without leaving the page
    view.overhangX = THREE.MathUtils.clamp(window.innerWidth - container.getBoundingClientRect().right - 14, 0, 30);
    // On-screen radius of the globe (plus a little for its glow), used to keep the report card clear of it
    view.globePx = (Math.tan(Math.asin(GLOBE_RADIUS / camera.position.z)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (height / 2) * 1.04;
    home.set(-view.halfW * 0.78, view.halfH * 0.6, FLY_DEPTH);
    root.scale.setScalar(THREE.MathUtils.clamp(view.halfH * 0.125, 0.045, 0.2));
    if (lastPosition.lengthSq() === 0) {
      root.position.copy(home);
      lastPosition.copy(home);
    }
    camera.updateMatrixWorld();
  };

  const update = (t: number, dt: number) => {
    // Chase the plane being tracked (pause to talk while the help bubble is open).
    // The robot hovers in front of the globe just above the plane and looks down at it, so the viewer sees
    // its back while it scans.
    const chased = slots[0].target;
    let lookYaw = 2.6;
    let lookPitch = 0.3;
    if (chased) {
      const p = worldPosition(chased, tmpC);
      const dx = p.x - root.position.x;
      const dy = p.y - root.position.y;
      const dz = p.z - root.position.z;
      lookYaw = Math.atan2(dx, dz);
      lookPitch = THREE.MathUtils.clamp(Math.atan2(-dy, Math.hypot(dx, dz)), -0.7, 0.9);
      if (!helpOpen) {
        desired.set(
          THREE.MathUtils.clamp(p.x - 0.1, -view.halfW * 0.88, view.halfW * 0.88),
          THREE.MathUtils.clamp(p.y + 0.22, -view.halfH * 0.78, view.halfH * 0.78),
          FLY_DEPTH,
        );
      }
    } else if (!helpOpen) {
      lookYaw = Math.atan2(-root.position.x, -root.position.z); // idle: gaze toward the middle of the globe
      desired.copy(home);
    }
    if (helpOpen) desired.copy(root.position);
    // Soft spring (slightly under-damped): eases out of a hover, glides, and settles with a tiny overshoot
    tmpA.copy(desired).sub(root.position);
    velocity.addScaledVector(tmpA, 9 * dt).multiplyScalar(Math.exp(-4.2 * dt));
    const speed = velocity.length();
    if (speed > 2.2) velocity.multiplyScalar(2.2 / speed);
    root.position.addScaledVector(velocity, dt);
    lastPosition.copy(root.position);

    // Idle motion + lean into the direction of flight
    rig.position.y = Math.sin(t * 1.4) * 0.05 + Math.sin(t * 2.3) * 0.012;
    rig.position.x = Math.sin(t * 0.9) * 0.02;
    {
      // shortest-way-round so the robot never spins a full turn when the target crosses behind it
      const diff = THREE.MathUtils.euclideanModulo(lookYaw - rig.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      rig.rotation.y += diff * (1 - Math.exp(-3 * dt));
    } // body is the slowest part: eyes lead, head follows, body catches up
    rig.rotation.x = THREE.MathUtils.damp(rig.rotation.x, lookPitch, 3, dt);
    rig.rotation.z = THREE.MathUtils.damp(rig.rotation.z, THREE.MathUtils.clamp(-velocity.x * 0.35, -0.35, 0.35), 3, dt);
    arms.forEach(({ arm, side }, i) => {
      // arms swing outward a little and trail behind the direction of flight
      arm.rotation.z = side * (0.18 + Math.sin(t * 1.6 + i) * 0.07) - THREE.MathUtils.clamp(velocity.x * 0.22, -0.5, 0.5);
      arm.position.y = -0.02 + Math.sin(t * 1.8 + i * 1.7) * 0.025;
    });
    antennaTip.scale.setScalar(1 + 0.45 * Math.max(0, Math.sin(t * 5)));
    thrusterMaterial.opacity = 0.2 + Math.sin(t * 9) * 0.06;
    hoverRing.scale.setScalar(1 + Math.sin(t * 3) * 0.04);
    const sweep = (t % 3.4) / 3.4;
    wave.scale.setScalar(1 + sweep * 5.5);
    waveMaterial.opacity = (1 - sweep) * (1 - sweep) * 0.5;
    rimLight.intensity = 0.45 + Math.sin(t * 2.3) * 0.12;

    root.updateMatrixWorld(true);
    head.getWorldPosition(headWorld);
    const eyeWorld = head.localToWorld(tmpB.copy(eyeLocal));

    // Re-target planes
    slots.forEach((slot, index) => {
      if (slot.target && !isTrackable(slot.target)) {
        slot.target = null;
        slot.nextPick = t;
      }
      if (!slot.target || t >= slot.nextPick) {
        pickTarget(slot);
        slot.nextPick = t + (index === 0 ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.8);
      }

      const target = slot.target;
      slot.line.visible = !!target;
      slot.ring.visible = !!target;
      if (!target) return;

      const position = worldPosition(target, tmpC);
      slot.positions.set([eyeWorld.x, eyeWorld.y, eyeWorld.z, position.x, position.y, position.z]);
      slot.line.geometry.attributes.position.needsUpdate = true;

      slot.ring.position.copy(position);
      slot.ring.quaternion.copy(camera.quaternion);
      const size = index === 0 ? 0.052 : 0.036;
      slot.ring.scale.setScalar(size * (1 + 0.18 * Math.sin(t * 9 + index)));
    });

    // Scan effect on the primary plane
    const scanTarget = slots[0].target;
    alertMix = THREE.MathUtils.damp(alertMix, scanTarget?.student.warning ? 1 : 0, 10, dt);
    const strong = tintStrong.copy(NORMAL).lerp(ALERT, alertMix);
    const soft = tintSoft.copy(NORMAL_SOFT).lerp(ALERT_SOFT, alertMix);
    scanConeMaterial.color.copy(strong);
    sweepMaterial.color.copy(strong);
    slots[0].ringMaterial.color.copy(strong);
    lineMaterials[0].color.copy(strong);
    pulseMaterials.forEach((material) => material.color.copy(soft));
    scanCone.visible = !!scanTarget && !helpOpen;
    pulses.forEach((pulse) => (pulse.visible = scanCone.visible));
    planeSweep.visible = scanCone.visible;
    if (scanTarget && scanCone.visible) {
      const targetPos = worldPosition(scanTarget, tmpC);
      scanDir.copy(targetPos).sub(eyeWorld);
      const length = scanDir.length();
      scanDir.divideScalar(length);
      scanQuat.setFromUnitVectors(DOWN, scanDir);
      scanCone.position.copy(eyeWorld);
      scanCone.quaternion.copy(scanQuat);
      scanCone.scale.set(SCAN_RADIUS, length, SCAN_RADIUS);
      scanConeMaterial.opacity = 0.08 + 0.04 * Math.sin(t * 7);

      scanQuat.setFromUnitVectors(FORWARD, scanDir);
      pulses.forEach((pulse, i) => {
        const f = (t * 0.9 + i * 0.5) % 1;
        pulse.position.copy(eyeWorld).addScaledVector(scanDir, length * f);
        pulse.quaternion.copy(scanQuat);
        pulse.scale.setScalar(Math.max(0.004, SCAN_RADIUS * f));
        pulseMaterials[i].opacity = Math.sin(Math.PI * f) * 0.75;
      });

      const g = (t * 1.3) % 1;
      planeSweep.position.copy(targetPos);
      planeSweep.quaternion.copy(camera.quaternion);
      planeSweep.scale.setScalar(0.03 + g * 0.08);
      sweepMaterial.opacity = (1 - g) * 0.7;
    }

    // Head follows the primary target (or idles)
    const primary = slots[0].target;
    if (primary) {
      aimer.position.copy(headWorld);
      aimer.lookAt(worldPosition(primary, tmpC));
      aimer.updateMatrixWorld();
      rig.getWorldQuaternion(parentQuat);
      targetQuat.copy(parentQuat).invert().multiply(aimer.quaternion);
      const angle = identity.angleTo(targetQuat);
      if (angle > MAX_HEAD_TURN) targetQuat.copy(identity).slerp(targetQuat, MAX_HEAD_TURN / angle);
    } else {
      idleEuler.set(Math.sin(t * 0.7) * 0.08, Math.sin(t * 0.45) * 0.4, 0);
      targetQuat.setFromEuler(idleEuler);
    }
    head.quaternion.slerp(targetQuat, 1 - Math.exp(-dt * 6.5));

    // Eyes: slide toward the target a touch ahead of the head, and blink now and then
    if (primary) {
      head.getWorldQuaternion(parentQuat);
      parentQuat.invert();
      const local = worldPosition(primary, tmpC).sub(headWorld).normalize().applyQuaternion(parentQuat);
      gaze.x = THREE.MathUtils.damp(gaze.x, THREE.MathUtils.clamp(local.x * 0.1, -0.035, 0.035), 22, dt);
      gaze.y = THREE.MathUtils.damp(gaze.y, THREE.MathUtils.clamp(local.y * 0.08, -0.03, 0.03), 22, dt);
    } else {
      gaze.x = THREE.MathUtils.damp(gaze.x, Math.sin(t * 0.6) * 0.02, 4, dt);
      gaze.y = THREE.MathUtils.damp(gaze.y, 0, 4, dt);
    }
    if (blinkStart < 0 && t > nextBlink) blinkStart = t;
    let lid = 1;
    if (blinkStart >= 0) {
      const phase = (t - blinkStart) / 0.16;
      if (phase >= 1) {
        blinkStart = -1;
        nextBlink = t + 2 + Math.random() * 3.5;
      } else {
        lid = 1 - Math.sin(phase * Math.PI) * 0.92;
      }
    }
    eyes.forEach(({ mesh, base }) => {
      mesh.position.set(base.x + gaze.x, base.y + gaze.y, base.z);
      mesh.scale.y = 1.1 * lid;
    });

    // Report + help bubble follow the robot
    showReport(primary ?? null);
    typeReport(dt);
    hud.classList.toggle("is-hidden", helpOpen);

    const width = container.clientWidth;
    const height = container.clientHeight;
    projected.copy(root.position).project(camera);
    const sx = (projected.x * 0.5 + 0.5) * width;
    const sy = (-projected.y * 0.5 + 0.5) * height;
    const robotPx = view.pxPerUnit * root.scale.x * 1.5;
    if (helpOpen) {
      const x = THREE.MathUtils.clamp(sx - helpSize.w / 2, 6, Math.max(6, width - helpSize.w - 6));
      let y = sy + robotPx * 0.55;
      if (y + helpSize.h > height - 6) y = sy - robotPx * 0.6 - helpSize.h;
      help.style.transform = `translate(${x}px, ${THREE.MathUtils.clamp(y, 6, Math.max(6, height - helpSize.h - 6))}px)`;
    }

    // The report is carried by the robot: it hangs right beside it (on whichever side has room) and glides along
    const gap = robotPx * 0.42;
    const roomRight = width + view.overhangX - (sx + gap) - 4;
    let targetX = roomRight >= hudSize.w ? sx + gap : sx - gap - hudSize.w;
    let targetY = sy - hudSize.h * 0.4;
    targetX = THREE.MathUtils.clamp(targetX, 2, Math.max(2, width + view.overhangX - hudSize.w));
    targetY = THREE.MathUtils.clamp(targetY, 2, Math.max(2, height + 20 - hudSize.h));
    if (!hudPlaced) {
      hudPos.x = targetX;
      hudPos.y = targetY;
      hudPlaced = true;
    } else {
      const follow = 1 - Math.exp(-dt * 9);
      hudPos.x += (targetX - hudPos.x) * follow;
      hudPos.y += (targetY - hudPos.y) * follow;
    }
    hud.style.transform = `translate(${hudPos.x}px, ${hudPos.y}px)`;
  };

  const dispose = () => {
    robotScene.remove(root, ambient, keyLight);
    slots.forEach((slot) => {
      scene.remove(slot.line, slot.ring);
    });
    scene.remove(scanCone, planeSweep, ...pulses);
    hud.remove();
    help.remove();
    trigger.remove();
    disposables.forEach((item) => item.dispose());
  };

  /** Draw the robot on top of the globe (call right after rendering the main scene). */
  const render = (renderer: THREE.WebGLRenderer) => {
    const previous = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(robotScene, camera);
    renderer.autoClear = previous;
  };

  return { update, resize, dispose, render, hitTest, toggleHelp: () => setHelp(!helpOpen) };
}
