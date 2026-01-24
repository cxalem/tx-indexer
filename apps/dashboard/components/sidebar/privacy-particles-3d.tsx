"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type AnimationMode = "enter" | "exit" | null;

interface PrivacyParticles3DProps {
  mode: AnimationMode;
  onComplete?: () => void;
  particleCount?: number;
  buttonX?: number;
  buttonY?: number;
}

interface ParticlesProps {
  mode: AnimationMode;
  onComplete?: () => void;
  particleCount: number;
  buttonX: number;
  buttonY: number;
}

const GRAVITY = 80;
const TERMINAL_VELOCITY = 120;
const AIR_RESISTANCE_X = 0.98;
const AIR_RESISTANCE_Y = 0.995;
const ENTER_DURATION = 1.2;
const FLOOR_PADDING = 5;
const FADE_OUT_DURATION = 0.8;
const SETTLE_DELAY = 0.3;
const FLUTTER_SPEED_MIN = 2.5;
const FLUTTER_SPEED_MAX = 4;
const FLUTTER_AMPLITUDE_X = 50;
const FLUTTER_AMPLITUDE_ROT = 0.6;

const PURPLE_COLORS = [
  new THREE.Color("#a855f7"),
  new THREE.Color("#9333ea"),
  new THREE.Color("#c084fc"),
  new THREE.Color("#7c3aed"),
  new THREE.Color("#8b5cf6"),
  new THREE.Color("#a78bfa"),
];

interface ParticleState {
  offsetX: number;
  offsetY: number;
  vx: number;
  vy: number;
  currentVx: number;
  currentVy: number;
  color: THREE.Color;
  scaleX: number;
  scaleY: number;
  flutterSpeed: number;
  flutterPhase: number;
  flutterAmplitudeX: number;
  flutterAmplitudeRot: number;
  rotation: number;
  rotationSpeed: number;
  delay: number;
  landed: boolean;
  landedTime: number;
  landedRotation: number;
}

function generateParticleStates(
  count: number,
  mode: AnimationMode,
): ParticleState[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + ((i * 0.5) % 0.8);
    const distance = 30 + (i % 5) * 10;

    const seed1 = ((i * 1337) % 1000) / 1000;
    const seed2 = ((i * 7919) % 1000) / 1000;
    const seed3 = ((i * 4253) % 1000) / 1000;
    const seed4 = ((i * 2657) % 1000) / 1000;

    const sizeCategory = i % 5;
    const baseScale = 0.8 + seed1 * 0.6;

    let scaleX: number;
    let scaleY: number;

    if (sizeCategory === 0) {
      scaleX = baseScale * 0.5;
      scaleY = baseScale * 0.5;
    } else if (sizeCategory === 1) {
      scaleX = baseScale * 1.2;
      scaleY = baseScale * 0.4;
    } else if (sizeCategory === 2) {
      scaleX = baseScale * 0.4;
      scaleY = baseScale * 1.1;
    } else if (sizeCategory === 3) {
      scaleX = baseScale * 0.8;
      scaleY = baseScale * 0.7;
    } else {
      scaleX = baseScale * 1.0;
      scaleY = baseScale * 0.9;
    }

    const flutterSpeed =
      FLUTTER_SPEED_MIN + seed2 * (FLUTTER_SPEED_MAX - FLUTTER_SPEED_MIN);
    const flutterPhase = seed3 * Math.PI * 2;
    const flutterAmplitudeX = FLUTTER_AMPLITUDE_X * (0.6 + seed4 * 0.6);
    const flutterAmplitudeRot = FLUTTER_AMPLITUDE_ROT * (0.6 + seed1 * 0.6);

    const rotation = seed2 * Math.PI * 2;
    const rotationSpeed = (seed3 - 0.5) * 1.5;

    if (mode === "enter") {
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      const speed = 80 + seed1 * 60;
      return {
        offsetX,
        offsetY,
        vx: -Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        currentVx: -Math.cos(angle) * speed,
        currentVy: -Math.sin(angle) * speed,
        color: PURPLE_COLORS[i % PURPLE_COLORS.length]!,
        scaleX,
        scaleY,
        flutterSpeed,
        flutterPhase,
        flutterAmplitudeX,
        flutterAmplitudeRot,
        rotation,
        rotationSpeed,
        delay: seed2 * 0.15,
        landed: false,
        landedTime: 0,
        landedRotation: 0,
      };
    } else {
      const burstSpeed = 40 + seed1 * 60;
      const upwardBoost = 30 + seed2 * 50;

      return {
        offsetX: 0,
        offsetY: 0,
        vx: Math.cos(angle) * burstSpeed * (0.6 + seed1 * 0.5),
        vy: Math.sin(angle) * burstSpeed * 0.3 + upwardBoost,
        currentVx: Math.cos(angle) * burstSpeed * (0.6 + seed1 * 0.5),
        currentVy: Math.sin(angle) * burstSpeed * 0.3 + upwardBoost,
        color: PURPLE_COLORS[i % PURPLE_COLORS.length]!,
        scaleX,
        scaleY,
        flutterSpeed,
        flutterPhase,
        flutterAmplitudeX,
        flutterAmplitudeRot,
        rotation,
        rotationSpeed,
        delay: seed2 * 0.06,
        landed: false,
        landedTime: 0,
        landedRotation: 0,
      };
    }
  });
}

function Particles({
  mode,
  onComplete,
  particleCount,
  buttonX,
  buttonY,
}: ParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const lastTimeRef = useRef<number>(0);
  const allLandedTimeRef = useRef<number | null>(null);

  const { size } = useThree();

  const buttonCenterX = useMemo(
    () => buttonX - size.width / 2,
    [buttonX, size.width],
  );
  const buttonCenterY = useMemo(
    () => size.height / 2 - buttonY,
    [buttonY, size.height],
  );
  const floorY = useMemo(
    () => -(size.height / 2) + FLOOR_PADDING,
    [size.height],
  );

  const positionsRef = useRef<{ x: number; y: number }[]>([]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vColor;
        void main() {
          #ifdef USE_INSTANCING_COLOR
            vColor = instanceColor;
          #else
            vColor = vec3(0.66, 0.33, 0.97);
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
    });
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const particles = useMemo(() => {
    if (!mode) return [];
    return generateParticleStates(particleCount, mode);
  }, [mode, particleCount]);

  useEffect(() => {
    if (mode === "exit") {
      positionsRef.current = particles.map(() => ({
        x: buttonCenterX,
        y: buttonCenterY,
      }));
    } else {
      positionsRef.current = particles.map((p) => ({
        x: buttonCenterX + p.offsetX,
        y: buttonCenterY + p.offsetY,
      }));
    }
  }, [particles, mode, buttonCenterX, buttonCenterY]);

  useEffect(() => {
    startTimeRef.current = null;
    completedRef.current = false;
    lastTimeRef.current = 0;
    allLandedTimeRef.current = null;
    particles.forEach((p) => {
      p.landed = false;
      p.landedRotation = 0;
    });
  }, [mode, particles]);

  useEffect(() => {
    if (!meshRef.current || particles.length === 0) return;

    const mesh = meshRef.current;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p) {
        mesh.setColorAt(i, p.color);
      }
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
      shaderMaterial.defines = shaderMaterial.defines || {};
      shaderMaterial.defines.USE_INSTANCING_COLOR = "";
      shaderMaterial.needsUpdate = true;
    }
  }, [particles, shaderMaterial]);

  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tempEuler = useMemo(() => new THREE.Euler(), []);

  useFrame((state) => {
    if (!meshRef.current || !mode || particles.length === 0) return;

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
      lastTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const deltaTime = Math.min(
      state.clock.elapsedTime - lastTimeRef.current,
      0.05,
    );
    lastTimeRef.current = state.clock.elapsedTime;

    const mesh = meshRef.current;

    if (mode === "enter") {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;

        const staggerDelay = p.delay * 0.3 + (i % 7) * 0.08;
        const particleTime = Math.max(0, elapsed - staggerDelay);
        const particleDuration =
          ENTER_DURATION * (0.5 + p.delay * 0.6 + (i % 5) * 0.1);
        const progress = Math.min(1, particleTime / particleDuration);
        const eased = 1 - Math.pow(1 - progress, 2.5);

        const startX = buttonCenterX + p.offsetX * 4;
        const startY = floorY + 15 + (i % 5) * 8;

        const buttonHalfWidth = 55;
        const buttonHalfHeight = 14;
        const cols = 6;
        const col = i % cols;
        const row = Math.floor(i / cols) % 3;
        const jitterX = (p.flutterPhase / Math.PI - 1) * 15;
        const jitterY = (p.rotation / Math.PI - 1) * 6;
        const endX =
          buttonCenterX +
          (col / (cols - 1) - 0.5) * 2 * buttonHalfWidth +
          jitterX;
        const endY =
          buttonCenterY + (row / 2 - 0.5) * 2 * buttonHalfHeight + jitterY;

        const arcHeight = 60 + p.delay * 40;
        const x = startX + (endX - startX) * eased;
        const y =
          startY +
          (endY - startY) * eased +
          arcHeight * Math.sin(eased * Math.PI);

        const flutterStrength = (1 - eased) * 0.6;
        const flutterX =
          Math.sin(particleTime * p.flutterSpeed * 1.5 + p.flutterPhase) *
          p.flutterAmplitudeX *
          0.4 *
          flutterStrength;

        const scaleProgress = Math.min(1, particleTime * 3);
        const fadeIn = Math.min(1, particleTime * 4);
        const fadeOut =
          progress >= 0.95 ? Math.max(0, 1 - (progress - 0.95) / 0.05) : 1;
        const opacity = fadeIn * fadeOut;

        const rotSpeed = p.rotationSpeed * 2 * (1 - eased * 0.8);
        const rot = p.rotation + particleTime * rotSpeed;

        tempPosition.set(x + flutterX, y, 0);
        tempEuler.set(0, 0, rot);
        tempQuaternion.setFromEuler(tempEuler);
        tempScale.set(
          p.scaleX * scaleProgress * opacity,
          p.scaleY * scaleProgress * opacity,
          1,
        );
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
        mesh.setMatrixAt(i, tempMatrix);
      }

      mesh.instanceMatrix.needsUpdate = true;

      if (elapsed > ENTER_DURATION + 0.15 && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    } else if (mode === "exit") {
      let allLanded = true;
      let allFadedOut = true;
      let anyParticleStarted = false;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const pos = positionsRef.current[i];
        if (!p || !pos) continue;

        const particleTime = Math.max(0, elapsed - p.delay);

        if (particleTime > 0) {
          anyParticleStarted = true;
          if (!p.landed) {
            p.currentVx *= Math.pow(AIR_RESISTANCE_X, deltaTime * 60);
            p.currentVy -= GRAVITY * deltaTime;
            p.currentVy *= Math.pow(AIR_RESISTANCE_Y, deltaTime * 60);

            if (p.currentVy < -TERMINAL_VELOCITY) {
              p.currentVy = -TERMINAL_VELOCITY;
            }

            pos.x += p.currentVx * deltaTime;
            pos.y += p.currentVy * deltaTime;

            if (pos.y <= floorY) {
              pos.y = floorY;
              p.landed = true;
              p.landedTime = elapsed;
              p.currentVx = 0;
              p.currentVy = 0;
              const currentRot = p.rotation + particleTime * p.rotationSpeed;
              p.landedRotation =
                Math.round(currentRot / (Math.PI / 4)) * (Math.PI / 4);
            }
          }

          if (!p.landed) {
            allLanded = false;
            allFadedOut = false;

            const flutterStrength = Math.min(1, particleTime * 0.3);
            const flutterX =
              Math.sin(particleTime * p.flutterSpeed + p.flutterPhase) *
              p.flutterAmplitudeX *
              flutterStrength;

            const wobbleRot =
              Math.sin(particleTime * p.flutterSpeed * 0.8 + p.flutterPhase) *
              p.flutterAmplitudeRot;
            const spinRot = particleTime * p.rotationSpeed;
            const totalRot = p.rotation + wobbleRot + spinRot;

            const scalePulse =
              1 + Math.sin(particleTime * p.flutterSpeed * 1.2) * 0.05;

            tempPosition.set(pos.x + flutterX, pos.y, 0);
            tempEuler.set(0, 0, totalRot);
            tempQuaternion.setFromEuler(tempEuler);
            tempScale.set(p.scaleX * scalePulse, p.scaleY * scalePulse, 1);
            tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
            mesh.setMatrixAt(i, tempMatrix);
          } else {
            // Landed - fade out based on when this particle landed
            const timeSinceLanded = elapsed - p.landedTime - SETTLE_DELAY;
            let fadeOpacity = 1;

            if (timeSinceLanded > 0) {
              fadeOpacity = Math.max(
                0,
                1 - timeSinceLanded / FADE_OUT_DURATION,
              );
            }

            if (fadeOpacity > 0.01) {
              allFadedOut = false;
            }

            // Fade by scaling down (per-particle, staggered)
            tempPosition.set(pos.x, pos.y, 0);
            tempEuler.set(0, 0, p.landedRotation);
            tempQuaternion.setFromEuler(tempEuler);
            tempScale.set(p.scaleX * fadeOpacity, p.scaleY * fadeOpacity, 1);
            tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
            mesh.setMatrixAt(i, tempMatrix);
          }
        } else {
          allLanded = false;
          allFadedOut = false;
          tempScale.set(0, 0, 0);
          tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
          mesh.setMatrixAt(i, tempMatrix);
        }
      }

      mesh.instanceMatrix.needsUpdate = true;

      if (allLanded && allLandedTimeRef.current === null) {
        allLandedTimeRef.current = elapsed;
      }

      // Only complete if particles actually started and all have faded
      if (
        anyParticleStarted &&
        allFadedOut &&
        allLandedTimeRef.current !== null &&
        !completedRef.current
      ) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
    }
  });

  if (!mode || particles.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, particleCount]}
      frustumCulled={false}
      material={shaderMaterial}
    >
      <planeGeometry args={[5, 6]} />
    </instancedMesh>
  );
}

export function PrivacyParticles3D({
  mode,
  onComplete,
  particleCount = 32,
  buttonX = 100,
  buttonY = 200,
}: PrivacyParticles3DProps) {
  const [isActive, setIsActive] = useState(false);
  const activeModeRef = useRef<AnimationMode>(null);

  useEffect(() => {
    if (mode) {
      setIsActive(true);
      activeModeRef.current = mode;
    }
  }, [mode]);

  const handleComplete = useCallback(() => {
    onComplete?.();
    setTimeout(() => {
      setIsActive(false);
      activeModeRef.current = null;
    }, 100);
  }, [onComplete]);

  const effectiveMode = isActive ? activeModeRef.current : null;

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 100], near: 0.1, far: 1000 }}
        style={{ background: "transparent", width: "100%", height: "100%" }}
        gl={{ alpha: true, antialias: true }}
      >
        <Particles
          mode={effectiveMode}
          onComplete={handleComplete}
          particleCount={particleCount}
          buttonX={buttonX}
          buttonY={buttonY}
        />
      </Canvas>
    </div>
  );
}
