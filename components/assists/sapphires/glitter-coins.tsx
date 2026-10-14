// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Replace the old glitter constants:
//   GLITTER_COUNT, GLITTER_COLOR, GLITTER_SPARK
// with this block (put it where those three lines were).
// ─────────────────────────────────────────────────────────────────────────────

/** Silver coin flakes floating around the jar. */
const GLITTER_COUNT = 160;
/** Width (x) and depth (z) of the flake field, in world units. The jar is ~1.05 wide. */
const GLITTER_FIELD_WIDTH = 7.5;
const GLITTER_FIELD_DEPTH = 5;
/** Vertical center of the field. Negative sits it low, around the jar's base. */
const GLITTER_FIELD_Y = -0.45;
/** Vertical spread of the field. Flakes bias toward the bottom of it. */
const GLITTER_FIELD_HEIGHT = 1.1;
/** Flakes are kept outside this radius around the jar so none sit inside it. */
const GLITTER_JAR_CLEAR = 0.75;
/** Coin radius range, in world units. */
const GLITTER_SIZE_MIN = 0.012;
const GLITTER_SIZE_MAX = 0.03;
/** Coin thickness as a fraction of its radius. */
const GLITTER_THICKNESS = 0.14;
/** Tumble speed range, radians per second. Low keeps the spin slow and lazy. */
const GLITTER_SPIN_MIN = 0.25;
const GLITTER_SPIN_MAX = 0.9;
/** How far each flake floats from its home position, in world units. */
const GLITTER_FLOAT = 0.12;
/** Float speed range. */
const GLITTER_FLOAT_SPEED_MIN = 0.08;
const GLITTER_FLOAT_SPEED_MAX = 0.2;
/** Silver base color. */
const GLITTER_COLOR = '#c9ced6';
/** Lower is shinier and gives sharper glints as the coins turn. */
const GLITTER_ROUGHNESS = 0.18;
/** How strongly the coins reflect the neutral studio strips. */
const GLITTER_ENV_INTENSITY = 1.6;

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Delete these three functions entirely:
//   glitterTexture(), ribbonAt(), GlitterStream()
// and paste this GlitterStream in their place. SapphiresScene doesn't change.
// It reuses useProductStudio() so the coins reflect neutral white light
// (true silver) instead of the blue scene environment.
// ─────────────────────────────────────────────────────────────────────────────

type Flake = {
  home: THREE.Vector3;
  axis: THREE.Vector3;
  tilt: THREE.Quaternion;
  spin: number;
  phase: number;
  floatSpeed: number;
  size: number;
  shade: number;
};

function makeFlakes(): Flake[] {
  return Array.from({ length: GLITTER_COUNT }, (_, i) => {
    // Wide in x, slightly denser toward the middle.
    const sx = rand(i * 1.37 + 5) * 2 - 1;
    let x = Math.sign(sx) * Math.pow(Math.abs(sx), 1.25) * GLITTER_FIELD_WIDTH * 0.5;
    let z = (rand(i * 2.91 + 13) - 0.5) * GLITTER_FIELD_DEPTH;
    // Biased low within the band.
    const y = GLITTER_FIELD_Y + (Math.pow(rand(i * 3.73 + 21), 1.4) - 0.5) * GLITTER_FIELD_HEIGHT;

    // Keep the jar clear.
    const r = Math.hypot(x, z);
    if (r < GLITTER_JAR_CLEAR) {
      const push = GLITTER_JAR_CLEAR + rand(i * 4.19 + 7) * 0.25;
      if (r < 1e-3) {
        x = push;
        z = 0;
      } else {
        x *= push / r;
        z *= push / r;
      }
    }

    const axis = new THREE.Vector3(
      rand(i * 5.11 + 2) - 0.5,
      rand(i * 6.07 + 3) - 0.5,
      rand(i * 7.03 + 4) - 0.5,
    );
    if (axis.lengthSq() < 1e-4) axis.set(0, 1, 0);
    axis.normalize();

    const tilt = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        rand(i * 8.3 + 1) * Math.PI * 2,
        rand(i * 9.7 + 2) * Math.PI * 2,
        rand(i * 10.9 + 3) * Math.PI * 2,
      ),
    );

    const direction = rand(i * 11.3 + 6) > 0.5 ? 1 : -1;
    const bright = rand(i * 12.7 + 8) > 0.88;

    return {
      home: new THREE.Vector3(x, y, z),
      axis,
      tilt,
      spin: direction * (GLITTER_SPIN_MIN + rand(i * 13.1 + 9) * (GLITTER_SPIN_MAX - GLITTER_SPIN_MIN)),
      phase: rand(i * 14.9 + 10) * Math.PI * 2,
      floatSpeed:
        GLITTER_FLOAT_SPEED_MIN + rand(i * 15.7 + 11) * (GLITTER_FLOAT_SPEED_MAX - GLITTER_FLOAT_SPEED_MIN),
      size: GLITTER_SIZE_MIN + rand(i * 16.3 + 12) * (GLITTER_SIZE_MAX - GLITTER_SIZE_MIN),
      shade: bright ? 1.3 : 0.82 + rand(i * 17.9 + 13) * 0.3,
    };
  });
}

function GlitterStream() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const envMap = useProductStudio();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spinQ = useMemo(() => new THREE.Quaternion(), []);
  const flakes = useMemo(makeFlakes, []);
  // A thin cylinder is a coin: flat faces flash as they turn toward the light strips.
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, GLITTER_THICKNESS, 20, 1), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const inst = mesh.current;
    if (!inst) return;
    const color = new THREE.Color();
    flakes.forEach((flake, i) => {
      color.setScalar(flake.shade);
      inst.setColorAt(i, color);
    });
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [flakes]);

  useFrame((state) => {
    const inst = mesh.current;
    if (!inst) return;
    const t = state.clock.elapsedTime;
    flakes.forEach((flake, i) => {
      const s = t * flake.floatSpeed + flake.phase;
      dummy.position.set(
        flake.home.x + Math.sin(s) * GLITTER_FLOAT,
        flake.home.y + Math.sin(s * 1.3 + 1.7) * GLITTER_FLOAT * 0.6,
        flake.home.z + Math.cos(s * 0.8) * GLITTER_FLOAT,
      );
      spinQ.setFromAxisAngle(flake.axis, t * flake.spin + flake.phase);
      dummy.quaternion.copy(spinQ).multiply(flake.tilt);
      dummy.scale.setScalar(flake.size);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined as unknown as THREE.Material, GLITTER_COUNT]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={GLITTER_COLOR}
        metalness={1}
        roughness={GLITTER_ROUGHNESS}
        envMap={envMap}
        envMapIntensity={GLITTER_ENV_INTENSITY}
      />
    </instancedMesh>
  );
}
