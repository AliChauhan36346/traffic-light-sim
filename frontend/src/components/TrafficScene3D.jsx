import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Tree Component (Stylized low-poly trees)                          */
/* ------------------------------------------------------------------ */
function Tree({ position }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.7, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>
      {/* Lower leaves */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <coneGeometry args={[0.45, 0.7, 5]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>
      {/* Upper leaves */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <coneGeometry args={[0.3, 0.5, 5]} />
        <meshStandardMaterial color="#4caf50" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Crosswalk (Zebra markings)                                         */
/* ------------------------------------------------------------------ */
function Crosswalk({ position, rotationY }) {
  const stripeWidth = 0.15;
  const stripeLength = 0.8;
  const spacing = 0.35;
  const stripesCount = 5;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {Array.from({ length: stripesCount }).map((_, i) => {
        const offset = (i - (stripesCount - 1) / 2) * spacing;
        return (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[offset, 0.008, 0]}
            receiveShadow
          >
            <planeGeometry args={[stripeWidth, stripeLength]} />
            <meshStandardMaterial color="#ffffff" roughness={1.0} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Road Component                                                      */
/* ------------------------------------------------------------------ */
function Road() {
  return (
    <group>
      {/* Concrete ground base (sidewalk level) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.9} />
      </mesh>

      {/* Vertical Road (North-South) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[3.2, 30]} />
        <meshStandardMaterial color="#2d3135" roughness={0.85} />
      </mesh>

      {/* Horizontal Road (East-West) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[30, 3.2]} />
        <meshStandardMaterial color="#2d3135" roughness={0.85} />
      </mesh>

      {/* Grass Quadrants */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.6, 0.01, -8.6]} receiveShadow castShadow>
        <planeGeometry args={[13.6, 13.6]} />
        <meshStandardMaterial color="#b4e197" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.6, 0.01, -8.6]} receiveShadow castShadow>
        <planeGeometry args={[13.6, 13.6]} />
        <meshStandardMaterial color="#b4e197" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.6, 0.01, 8.6]} receiveShadow castShadow>
        <planeGeometry args={[13.6, 13.6]} />
        <meshStandardMaterial color="#b4e197" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.6, 0.01, 8.6]} receiveShadow castShadow>
        <planeGeometry args={[13.6, 13.6]} />
        <meshStandardMaterial color="#b4e197" roughness={0.9} />
      </mesh>

      {/* Double Yellow center lines */}
      {/* North Center Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.04, 0.005, -8.5]} receiveShadow>
        <planeGeometry args={[0.04, 13]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.04, 0.005, -8.5]} receiveShadow>
        <planeGeometry args={[0.04, 13]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>

      {/* South Center Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.04, 0.005, 8.5]} receiveShadow>
        <planeGeometry args={[0.04, 13]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.04, 0.005, 8.5]} receiveShadow>
        <planeGeometry args={[0.04, 13]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>

      {/* East Center Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.5, 0.005, -0.04]} receiveShadow>
        <planeGeometry args={[13, 0.04]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.5, 0.005, 0.04]} receiveShadow>
        <planeGeometry args={[13, 0.04]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>

      {/* West Center Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.5, 0.005, -0.04]} receiveShadow>
        <planeGeometry args={[13, 0.04]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.5, 0.005, 0.04]} receiveShadow>
        <planeGeometry args={[13, 0.04]} />
        <meshStandardMaterial color="#f59e0b" roughness={1.0} />
      </mesh>

      {/* Crosswalks */}
      <Crosswalk position={[0, 0, -1.8]} rotationY={0} />
      <Crosswalk position={[0, 0, 1.8]} rotationY={0} />
      <Crosswalk position={[1.8, 0, 0]} rotationY={Math.PI / 2} />
      <Crosswalk position={[-1.8, 0, 0]} rotationY={Math.PI / 2} />

      {/* Decorative trees in grass quadrants */}
      <Tree position={[6.0, 0, -6.0]} />
      <Tree position={[11.0, 0, -5.5]} />
      <Tree position={[5.5, 0, -11.0]} />

      <Tree position={[-6.0, 0, -6.0]} />
      <Tree position={[-11.0, 0, -7.5]} />
      <Tree position={[-7.5, 0, -11.0]} />

      <Tree position={[6.0, 0, 6.0]} />
      <Tree position={[10.5, 0, 8.5]} />
      <Tree position={[8.5, 0, 10.5]} />

      <Tree position={[-6.0, 0, 6.0]} />
      <Tree position={[-9.5, 0, 5.5]} />
      <Tree position={[-5.5, 0, 9.5]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Traffic Light Pole                                                  */
/* ------------------------------------------------------------------ */
function RoadLabel({ position, label }) {
  return (
    <Html position={position} center>
      <div
        style={{
          background: "rgba(255, 255, 255, 0.88)",
          color: "#111827",
          padding: "4px 8px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          border: "1px solid rgba(31, 41, 55, 0.16)",
          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
          whiteSpace: "nowrap",
        }}
      >
        Road {label}
      </div>
    </Html>
  );
}

function TrafficLight({ position, rotationY, signalState, queueLength, countdown, armLength = 1.2 }) {
  const poleHeight = 3.2;
  const armHeight = 3.0;
  const absArmLength = Math.abs(armLength);
  const armSign = Math.sign(armLength);
  const isGreen = signalState === "green";
  const isYellow = signalState === "yellow";

  // Colors for three lenses (ON vs OFF states)
  const redOn = "#ef4444";
  const redOff = "#3b0c0c";
  const yellowOn = "#facc15";
  const yellowOff = "#3d2a04";
  const greenOn = "#10b981";
  const greenOff = "#04331e";

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 1. Vertical Post */}
      <mesh position={[0, poleHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.10, poleHeight, 16]} />
        <meshStandardMaterial color="#78909c" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* 2. Horizontal Mast Arm extending along local X axis (towards road) */}
      <mesh position={[armLength / 2, armHeight, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.045, 0.065, absArmLength, 16]} />
        <meshStandardMaterial color="#78909c" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* Support strut/connector */}
      <mesh position={[0.2 * armSign, armHeight - 0.2, 0]} rotation={[0, 0, (Math.PI / 4) * armSign]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.45, 8]} />
        <meshStandardMaterial color="#78909c" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* 3. Hanging Signal Head (placed at the tip of the arm) */}
      <group position={[armLength, armHeight - 0.3, 0]}>
        {/* Yellow Backplate */}
        <mesh castShadow position={[0, 0, 0.01]}>
          <boxGeometry args={[0.34, 0.74, 0.02]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.4} />
        </mesh>

        {/* Black Backplate Border */}
        <mesh position={[0, 0, 0.005]}>
          <boxGeometry args={[0.38, 0.78, 0.01]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>

        {/* Dark Housing */}
        <mesh position={[0, 0, 0.1]} castShadow>
          <boxGeometry args={[0.26, 0.66, 0.18]} />
          <meshStandardMaterial color="#2d3748" roughness={0.5} />
        </mesh>

        {/* Red Light Bulb */}
        <mesh position={[0, 0.2, 0.2]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial
            color={!isGreen && !isYellow ? redOn : redOff}
            emissive={!isGreen && !isYellow ? redOn : redOff}
            emissiveIntensity={!isGreen && !isYellow ? 1.8 : 0.0}
          />
        </mesh>
        {/* Red Visor */}
        <mesh position={[0, 0.2, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.08, 16, 1, true]} />
          <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
        </mesh>

        {/* Yellow Light Bulb */}
        <mesh position={[0, 0, 0.2]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial
            color={isYellow ? yellowOn : yellowOff}
            emissive={isYellow ? yellowOn : yellowOff}
            emissiveIntensity={isYellow ? 1.8 : 0.0}
          />
        </mesh>
        {/* Yellow Visor */}
        <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.08, 16, 1, true]} />
          <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
        </mesh>

        {/* Green Light Bulb */}
        <mesh position={[0, -0.2, 0.2]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial
            color={isGreen ? greenOn : greenOff}
            emissive={isGreen ? greenOn : greenOff}
            emissiveIntensity={isGreen ? 1.8 : 0.0}
          />
        </mesh>
        {/* Green Visor */}
        <mesh position={[0, -0.2, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.08, 16, 1, true]} />
          <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Floating details overlay */}
      <Html position={[armLength, armHeight + 0.6, 0]} center>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.92)",
            color: "#1f2937",
            padding: "4px 8px",
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            whiteSpace: "nowrap",
            border: `2px solid ${isGreen ? "#10b981" : isYellow ? "#facc15" : "#ef4444"}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {signalState.toUpperCase()}
          <br />
          Q: {queueLength}
          <br />
          T: {countdown ?? 0}s
        </div>
      </Html>
    </group>
  );
}

const TURN_OPTIONS = ["straight", "straight", "left", "right"];
const ROAD_SPAWN_PROGRESS = -14.0;
const ROAD_EXIT_PROGRESS = 20.0;
const CAR_SPACING = 2.8;

function chooseRandomTurn() {
  return TURN_OPTIONS[Math.floor(Math.random() * TURN_OPTIONS.length)];
}

function createSimCar(laneIdx, carIdx, carColors, progress = ROAD_SPAWN_PROGRESS - carIdx * CAR_SPACING) {
  return {
    id: `${laneIdx}-${carIdx}-${Math.random().toString(36).slice(2)}`,
    progress,
    speed: 0.0,
    maxSpeed: 0.035 + Math.random() * 0.02,
    color: carColors[(laneIdx * 7 + carIdx) % carColors.length],
    route: chooseRandomTurn(),
  };
}

function getDirectionForRoute(laneIdx, route) {
  const routeMap = [
    { straight: "south", left: "east", right: "west" },
    { straight: "north", left: "west", right: "east" },
    { straight: "west", left: "south", right: "north" },
    { straight: "east", left: "north", right: "south" },
  ];

  return routeMap[laneIdx][route] ?? routeMap[laneIdx].straight;
}

function getRoadTransform(direction, p) {
  if (direction === "south") return { position: [0.7, 0.11, p], rotationY: 0 };
  if (direction === "north") return { position: [-0.7, 0.11, -p], rotationY: Math.PI };
  if (direction === "west") return { position: [-p, 0.11, 0.7], rotationY: -Math.PI / 2 };
  return { position: [p, 0.11, -0.7], rotationY: Math.PI / 2 };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

function getCarTransform(laneIdx, route, progress) {
  const incomingDirection = ["south", "north", "west", "east"][laneIdx];
  const outgoingDirection = getDirectionForRoute(laneIdx, route);
  const turnStart = -1.2;
  const turnEnd = 1.2;

  if (progress <= turnStart) {
    return getRoadTransform(incomingDirection, progress);
  }

  if (progress >= turnEnd) {
    return getRoadTransform(outgoingDirection, progress);
  }

  const start = getRoadTransform(incomingDirection, turnStart);
  const end = getRoadTransform(outgoingDirection, turnEnd);
  const rawT = (progress - turnStart) / (turnEnd - turnStart);
  const t = rawT * rawT * (3 - 2 * rawT);

  return {
    position: [
      lerp(start.position[0], end.position[0], t),
      0.11,
      lerp(start.position[2], end.position[2], t),
    ],
    rotationY: lerpAngle(start.rotationY, end.rotationY, t),
  };
}

function Car({ laneIdx, carIdx, carsRef }) {
  const meshRef = useRef();

  useFrame(() => {
    if (!meshRef.current || !carsRef.current) return;
    const car = carsRef.current[laneIdx][carIdx];
    if (!car) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;
    const transform = getCarTransform(laneIdx, car.route ?? "straight", car.progress);
    meshRef.current.position.set(...transform.position);
    meshRef.current.rotation.set(0, transform.rotationY, 0);

    // Dynamically update material color
    if (meshRef.current.children[0] && meshRef.current.children[0].material) {
      meshRef.current.children[0].material.color.set(car.color);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Chassis (Main Body) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.16, 0.95]} />
        <meshStandardMaterial color="#bbb" roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Cabin (Glass & Pillars) */}
      <mesh position={[0, 0.16, -0.05]} castShadow>
        <boxGeometry args={[0.44, 0.13, 0.55]} />
        <meshStandardMaterial color="#1f2937" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Roof cap */}
      <mesh position={[0, 0.23, -0.05]} castShadow>
        <boxGeometry args={[0.44, 0.02, 0.55]} />
        <meshStandardMaterial color="#bbb" roughness={0.2} />
      </mesh>

      {/* Wheels */}
      {/* Front Left */}
      <mesh position={[-0.26, -0.05, 0.25]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      {/* Front Right */}
      <mesh position={[0.26, -0.05, 0.25]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      {/* Rear Left */}
      <mesh position={[-0.26, -0.05, -0.25]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      {/* Rear Right */}
      <mesh position={[0.26, -0.05, -0.25]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.18, 0.02, 0.485]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#fffec4" emissive="#fffec4" emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[0.18, 0.02, 0.485]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#fffec4" emissive="#fffec4" emissiveIntensity={1.8} />
      </mesh>

      {/* Taillights */}
      <mesh position={[-0.18, 0.02, -0.485]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.18, 0.02, -0.485]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* 3D Scene Container                                                  */
/* ------------------------------------------------------------------ */
export default function TrafficScene3D({ simData, error, arrivalRates, onMeasuredCountsChange }) {
  const lanes = simData?.lanes ?? [];

  // Color pool for car randomization
  const carColors = useMemo(
    () => ["#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f43f5e", "#ff5722"],
    []
  );

  // Initialize stateful cars in a ref for fast, lag-free physics updates inside useFrame
  const carsRef = useRef(
    Array.from({ length: 4 }).map((_, laneIdx) =>
      Array.from({ length: 4 }).map((_, carIdx) => createSimCar(laneIdx, carIdx, carColors))
    )
  );
  const spawnAccumulatorsRef = useRef([0, 0, 0, 0]);
  const [visibleCarCounts, setVisibleCarCounts] = useState([4, 4, 4, 4]);

  return (
    <div style={styles.container}>
      <div style={styles.canvasWrapper}>
        <Canvas shadows camera={{ position: [11, 8.5, 11], fov: 45 }}>
          {/* Sky background and subtle distance fog */}
          <color attach="background" args={["#eef2f7"]} />
          <fog attach="fog" args={["#eef2f7", 16, 36]} />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[8, 14, 8]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0001}
          />
          <directionalLight position={[-4, 8, -4]} intensity={0.25} />

          <Road />

          {/* Render Traffic Lights (One pole per road branch) */}
          {[0, 1, 2, 3].map((i) => {
            const lane = lanes[i] || { queue_length: 0, waiting_time: 0, is_green: false };

            // Side-of-road pole placement and arm direction:
            // Lane 0: Northbound traffic from North -> South, pole on east side, head faces north.
            // Lane 1: Southbound traffic from South -> North, pole on west side, head faces south.
            // Lane 2: Eastbound traffic from East -> West, pole on south side, head faces east.
            // Lane 3: Westbound traffic from West -> East, pole on north side, head faces west.
            const poleConfig = [
              [1.9, 0, -2.2, Math.PI, 1.2],
              [-1.9, 0, 2.2, 0, 1.2],
              [2.2, 0, 1.9, Math.PI / 2, 1.2],
              [-2.2, 0, -1.9, -Math.PI / 2, 1.2],
            ][i];

            return (
              <TrafficLight
                key={`pole-${i}`}
                position={[poleConfig[0], poleConfig[1], poleConfig[2]]}
                rotationY={poleConfig[3]}
                armLength={poleConfig[4]}
                signalState={lane.signal_state ?? (lane.is_green ? "green" : "red")}
                queueLength={lane.queue_length ?? 0}
                countdown={lane.signal_countdown ?? 0}
              />
            );
          })}

          {/* Road labels for easier communication */}
          <RoadLabel position={[0, 0, -5]} label="1 (North)" />
          <RoadLabel position={[0, 0, 5]} label="2 (South)" />
          <RoadLabel position={[5, 0, 0]} label="3 (East)" />
          <RoadLabel position={[-5, 0, 0]} label="4 (West)" />

          {/* Render Cars */}
          {[0, 1, 2, 3].map((laneIdx) =>
            Array.from({ length: visibleCarCounts[laneIdx] }).map((_, carIdx) => (
              <Car
                key={`${laneIdx}-${carIdx}`}
                laneIdx={laneIdx}
                carIdx={carIdx}
                carsRef={carsRef}
              />
            ))
          )}

          {/* Physics loop wrapper */}
          <PhysicsLoop
            lanes={lanes}
            carsRef={carsRef}
            carColors={carColors}
            arrivalRates={arrivalRates}
            spawnAccumulatorsRef={spawnAccumulatorsRef}
            setVisibleCarCounts={setVisibleCarCounts}
            onMeasuredCountsChange={onMeasuredCountsChange}
          />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            maxPolarAngle={Math.PI / 2 - 0.05} // prevent going under the ground
            minDistance={4}
            maxDistance={25}
          />
        </Canvas>
      </div>

      {/* Status Overlay */}
      {error && (
        <div style={styles.error}>
          ⚠️ Backend unreachable. Verify that uvicorn/app.py is running.
        </div>
      )}

      {simData?.prediction && (
        <div style={styles.predictionBar}>
          <span style={{ fontWeight: 700, color: "#d97706" }}>
            DQN: {simData.prediction.action_label}
          </span>
          <span style={{ fontWeight: 600 }}>
            Q-values: [{simData.prediction.q_values.map((v) => v.toFixed(2)).join(", ")}]
          </span>
          <span style={{ fontWeight: 600 }}>
            Est. Wait: {simData.prediction.predicted_wait_reduction.toFixed(0)}s
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dynamic Physics & Queueing Loop                                    */
/* ------------------------------------------------------------------ */
function PhysicsLoop({
  lanes,
  carsRef,
  carColors,
  arrivalRates,
  spawnAccumulatorsRef,
  setVisibleCarCounts,
  onMeasuredCountsChange,
}) {
  const reportTimerRef = useRef(0);

  useFrame((_, delta) => {
    if (!carsRef.current) return;
    const frameScale = Math.min(delta * 60, 1.5);
    reportTimerRef.current += delta;

    for (let i = 0; i < 4; i++) {
      const signalState = lanes[i]?.signal_state ?? (lanes[i]?.is_green ? "green" : "red");
      const isGreen = signalState === "green";
      const cars = carsRef.current[i];
      const arrivalRate = Math.max(0, arrivalRates?.[i] ?? 0);

      spawnAccumulatorsRef.current[i] += arrivalRate * delta;
      while (spawnAccumulatorsRef.current[i] >= 1 && cars.length < 24) {
        const minProgress = cars.length
          ? Math.min(...cars.map((car) => car.progress))
          : ROAD_SPAWN_PROGRESS + CAR_SPACING;
        const nextProgress = Math.min(ROAD_SPAWN_PROGRESS, minProgress - CAR_SPACING);
        cars.push(createSimCar(i, cars.length, carColors, nextProgress));
        spawnAccumulatorsRef.current[i] -= 1;
      }

      if (cars.length >= 24) {
        spawnAccumulatorsRef.current[i] = Math.min(spawnAccumulatorsRef.current[i], 1);
      }

      // Update positions
      for (let j = 0; j < cars.length; j++) {
        const car = cars[j];
        const isBeforeStopLine = car.progress < -2.0;
        const isApproachingStopLine = car.progress > -6.0 && isBeforeStopLine;
        const mustStopForSignal = !isGreen && isApproachingStopLine;

        if (mustStopForSignal) {
          const stopTarget = j === 0 ? -2.0 : Math.min(-2.0, cars[j - 1].progress - 1.35);
          car.speed = Math.max(0, car.speed - 0.004 * frameScale);
          if (car.progress > stopTarget - 0.15) {
            car.progress = stopTarget;
            car.speed = 0;
          }
        } else if (j === 0) {
          car.speed = Math.min(car.maxSpeed, car.speed + 0.001 * frameScale);
        } else {
          // Follower car behavior (queueing)
          const carAhead = cars[j - 1];
          const spacing = carAhead.progress - car.progress;
          const safeSpacing = 1.6;

          if (spacing < safeSpacing) {
            // Decelerate to avoid collision
            car.speed = Math.max(0, car.speed - 0.004 * frameScale);
            if (spacing < 1.35) {
              car.progress = carAhead.progress - 1.35;
              car.speed = 0;
            }
          } else {
            // Accelerate towards maximum speed
            car.speed = Math.min(car.maxSpeed, car.speed + 0.0011 * frameScale);
          }
        }

        // Apply speed
        car.progress += car.speed * frameScale;
      }

      // Check and recycle/remove the lead car only after it reaches the far road end.
      if (cars[0]?.progress > ROAD_EXIT_PROGRESS) {
        cars.shift();
      }
    }

    if (reportTimerRef.current >= 0.5) {
      reportTimerRef.current = 0;
      const counts = carsRef.current.map((cars) => cars.length);
      setVisibleCarCounts(counts);
      onMeasuredCountsChange?.(counts);
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Styles (Glassmorphism & Light Theme UI)                             */
/* ------------------------------------------------------------------ */
const styles = {
  container: {
    width: "100%",
    maxWidth: 1100,
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.75)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.04)",
    position: "relative",
  },
  canvasWrapper: {
    width: "100%",
    height: 500,
  },
  error: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(239, 68, 68, 0.95)",
    color: "#fff",
    padding: "8px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    boxShadow: "0 4px 15px rgba(239, 68, 68, 0.2)",
  },
  predictionBar: {
    display: "flex",
    justifyContent: "center",
    gap: 24,
    padding: "12px 20px",
    background: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    color: "#4b5563",
    borderTop: "1px solid rgba(0, 0, 0, 0.06)",
    flexWrap: "wrap",
  },
};
