import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
// @ts-ignore - three examples utility has no TS types by default
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ContributionDay } from "@/hooks/useGitHubHeatmap";
import { Button } from "@/components/ui/button";
import { Bot, PartyPopper } from "lucide-react";

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

interface HeatmapSceneProps {
  username: string;
  peers: Array<{
    id: string;
    name: string;
    x: number;
    z: number;
    isMoving?: boolean;
    isRunning?: boolean;
    heading?: number;
    speed?: number;
    skinTier?: "none" | "common" | "uncommon" | "rare" | "epic" | "mythic";
  }>;
  contributions?: ContributionDay[] | null;
  peerAudio?: Record<string, MediaStream | undefined>;
}

interface TileData {
  x: number;
  z: number;
  height: number;
  level: HeatLevel;
}

const generateFakeHeatmap = (username: string): TileData[] => {
  const seed = Array.from(username).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) || 42;
  const rng = (() => {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  })();

  const cols = 32;
  const rows = 7;
  const tiles: TileData[] = [];

  for (let x = 0; x < cols; x++) {
    for (let z = 0; z < rows; z++) {
      const noise = rng();
      const streakBias = Math.sin((x / cols) * Math.PI * 2) * 0.4 + 0.6;
      const value = noise * streakBias;
      const level: HeatLevel =
        value > 0.82 ? 4 : value > 0.65 ? 3 : value > 0.45 ? 2 : value > 0.25 ? 1 : 0;
      const height = 0.1 + level * 0.35;
      tiles.push({ x, z, height, level });
    }
  }

  return tiles;
};

const generateTilesFromContributions = (contributions: ContributionDay[]): TileData[] => {
  const cols = 32;
  const rows = 7;

  const weekMap = new Map<number, Map<number, ContributionDay>>();

  contributions.forEach((day) => {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay();
    const weekOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
        (1000 * 60 * 60 * 24 * 7),
    );

    if (!weekMap.has(weekOfYear)) {
      weekMap.set(weekOfYear, new Map());
    }
    weekMap.get(weekOfYear)!.set(dayOfWeek, day);
  });

  const weeks = Array.from(weekMap.keys()).sort((a, b) => b - a);
  const sampled = weeks.slice(0, cols);

  const tiles: TileData[] = [];

  for (let x = 0; x < cols; x++) {
    const weekIdx = sampled[cols - 1 - x];
    const weekData = weekMap.get(weekIdx);

    for (let z = 0; z < rows; z++) {
      const day = weekData?.get(z);
      const level: HeatLevel = day?.level ?? 0;
      const height = 0.1 + level * 0.35;
      tiles.push({ x, z, height, level });
    }
  }

  return tiles;
};

const levelColor: Record<HeatLevel, [number, number, number]> = {
  0: [0.0, 0.05, 0.03],
  1: [0.1, 0.3, 0.22],
  2: [0.15, 0.45, 0.3],
  3: [0.2, 0.65, 0.32],
  4: [0.3, 0.85, 0.35],
};

const Avatar = ({
  x,
  z,
  y,
  name,
  isMoving = false,
  isRunning = false,
  heading = 0,
  speed = 0,
  showLabel = true,
  scale = 0.6,
  isDancing = false,
  skinTier = "none",
  onClick,
}: {
  x: number;
  z: number;
  y: number;
  name: string;
  isMoving?: boolean;
  isRunning?: boolean;
  heading?: number;
  speed?: number;
  showLabel?: boolean;
  scale?: number;
  isDancing?: boolean;
  skinTier?: "none" | "common" | "uncommon" | "rare" | "epic" | "mythic";
  onClick?: () => void;
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<string | null>(null);

  const gltf: any = useGLTF("/models/Soldier.glb");
  const animations: THREE.AnimationClip[] = gltf.animations || [];

  // Initialize model + mixer once
  useEffect(() => {
    if (!groupRef.current || !gltf.scene || !animations.length) return;

    // Avoid re-initializing if mixer already exists
    if (mixerRef.current) return;

    const clonedScene = clone(gltf.scene);

    clonedScene.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    groupRef.current.add(clonedScene);
    mixerRef.current = new THREE.AnimationMixer(clonedScene);

    // Start in idle
    const idleClip = animations[0];
    if (idleClip) {
      const idleAction = mixerRef.current.clipAction(idleClip);
      idleAction.play();
      currentActionRef.current = "idle";
    }
  }, [gltf.scene, animations]);

  // Switch between idle / walk / run based on movement state
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || !animations.length) return;

    const moving = isMoving && speed > 0.1;
    let targetName: "idle" | "walk" | "run" = "idle";
    let targetClip: THREE.AnimationClip | null = null;

    if (!moving) {
      targetName = "idle";
      targetClip = animations[0] ?? null; // idle
    } else if (isRunning || speed > 4) {
      targetName = "run";
      targetClip = animations[1] ?? null; // run
    } else {
      targetName = "walk";
      targetClip = animations[3] ?? null; // walk
    }

    if (!targetClip || currentActionRef.current === targetName) return;

    const newAction = mixer.clipAction(targetClip);
    newAction.reset().fadeIn(0.15).play();

    if (currentActionRef.current) {
      const prevClip =
        currentActionRef.current === "idle"
          ? animations[0]
          : currentActionRef.current === "run"
            ? animations[1]
            : animations[3];
      if (prevClip) {
        const prevAction = mixer.clipAction(prevClip);
        prevAction.fadeOut(0.15);
      }
    }

    currentActionRef.current = targetName;
  }, [isMoving, isRunning, speed, animations]);

  // Advance animations each frame
  useFrame((_, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    if (groupRef.current) {
      if (isDancing) {
        // Spin + bouncy "dance" with some body sway
        const danceSpeed = 4;
        const wobbleSpeed = 6;
        const wobbleAmount = 0.25;
        const bobAmount = 0.08;

        groupRef.current.rotation.y += delta * danceSpeed;
        const t = performance.now() / 1000;
        groupRef.current.position.y = Math.sin(t * wobbleSpeed) * bobAmount;
        groupRef.current.rotation.z = Math.sin(t * wobbleSpeed * 0.8) * wobbleAmount;
        groupRef.current.rotation.x = Math.sin(t * wobbleSpeed * 0.6) * (wobbleAmount * 0.4);
      } else {
        // Reset extra offsets when not dancing
        groupRef.current.position.y = 0;
        groupRef.current.rotation.x = 0;
        groupRef.current.rotation.z = 0;
      }
    }
  });

  return (
    <group position={[x, y, z]} rotation={[0, heading, 0]} scale={scale} onClick={onClick}>
      {/* Avatar model */}
      <group ref={groupRef} rotation={[0, Math.PI, 0]} />
      {/* Streak-based skin ring under the avatar */}
      {skinTier !== "none" && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
          <ringGeometry args={[0.35, 0.5, 32]} />
          <meshBasicMaterial
            color={
              skinTier === "mythic"
                ? new THREE.Color(0.9, 0.8, 0.2)
                : skinTier === "epic"
                  ? new THREE.Color(0.7, 0.4, 0.9)
                  : skinTier === "rare"
                    ? new THREE.Color(0.3, 0.6, 1.0)
                    : skinTier === "uncommon"
                      ? new THREE.Color(0.3, 0.9, 0.6)
                      : new THREE.Color(0.8, 0.8, 0.8)
            }
          />
        </mesh>
      )}
      {showLabel && (
        <Html distanceFactor={11} position={[0, 2.4, 0]} center>
          <div className="max-w-[80px] truncate whitespace-nowrap rounded-sm border border-border bg-background/90 px-2 py-1 text-[10px] font-medium shadow-xs">
            {name}
          </div>
        </Html>
      )}
    </group>
  );
};

useGLTF.preload("/models/Soldier.glb");

const HeatmapWorld = ({ username, peers, contributions, peerAudio }: HeatmapSceneProps) => {
  const tiles = useMemo(() => {
    if (contributions && contributions.length > 0) {
      return generateTilesFromContributions(contributions);
    }
    return generateFakeHeatmap(username);
  }, [username, contributions]);

  const cols = 32;
  const rows = 7;
  const offsetX = -cols / 2;
  const offsetZ = -rows / 2;
  const tileSize = 0.9;

  const contributionMeta = useMemo(() => {
    if (!contributions || contributions.length === 0) return null;

    const nonZero = contributions.filter((c) => c.count > 0);
    if (nonZero.length === 0) return null;

    const sorted = [...nonZero].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const start = new Date(sorted[0].date);
    const end = new Date(sorted[sorted.length - 1].date);

    const weekMap = new Map<number, Map<number, ContributionDay>>();
    nonZero.forEach((day) => {
      const d = new Date(day.date);
      const dayOfWeek = d.getDay();
      const weekOfYear = Math.floor(
        (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) /
          (1000 * 60 * 60 * 24 * 7),
      );
      if (!weekMap.has(weekOfYear)) {
        weekMap.set(weekOfYear, new Map());
      }
      weekMap.get(weekOfYear)!.set(dayOfWeek, day);
    });

    const weeks = Array.from(weekMap.keys()).sort((a, b) => a - b);
    const cols = 32;
    const rows = 7;
    const offsetX = -cols / 2;
    const offsetZ = -rows / 2;
    const tileSize = 0.9;

    const earliest = weeks[0];
    const latest = weeks[weeks.length - 1];

    const firstWeek = earliest;
    const lastWeek = latest;

    const startDate = new Date(start);
    const endDate = new Date(end);

    const startColIndex = 0;
    const endColIndex = Math.min(cols - 1, lastWeek - firstWeek);

    const startPos = {
      col: startColIndex,
      row: startDate.getDay(),
      worldX: offsetX + startColIndex * tileSize,
      worldZ: offsetZ + startDate.getDay() * tileSize,
    };

    const endPos = {
      col: endColIndex,
      row: endDate.getDay(),
      worldX: offsetX + endColIndex * tileSize,
      worldZ: offsetZ + endDate.getDay() * tileSize,
    };

    return {
      start,
      end,
      startPos,
      endPos,
    };
  }, [contributions]);

  const activityScore = useMemo(() => {
    if (!contributions || contributions.length === 0) return 0.3;
    const totalLevel = contributions.reduce((sum, day) => sum + day.level, 0);
    const maxTotal = contributions.length * 4 || 1;
    return Math.min(1, totalLevel / maxTotal);
  }, [contributions]);

  const getTileHeightAt = (x: number, z: number) => {
    const col = Math.round((x - offsetX) / tileSize);
    const row = Math.round((z - offsetZ) / tileSize);

    const maxRow = rows - 1;
    const safeRow = Math.max(0, Math.min(maxRow, row));

    if (col < 0 || col >= cols) return 0.1;

    const index = safeRow + col * rows;
    const tile = tiles[index];
    return tile?.height ?? 0.1;
  };

  const groundSizeX = cols * tileSize + 6;
  const groundSizeZ = rows * tileSize + 6;

  const controlsRef = useRef<any>(null);
  const cameraTargetRef = useRef<THREE.Vector3 | null>(null);
  const userInteractingRef = useRef(false);

  const centerX = 0;
  const centerZ = 0;

  const initialCameraTarget = new THREE.Vector3(centerX, 0.6, centerZ);

  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [dancePeerId, setDancePeerId] = useState<string | null>(null);
  const [monsterPair, setMonsterPair] = useState<
    | {
        baseId: string;
        riderId: string;
      }
    | null
  >(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.copy(initialCameraTarget);
  }, []);

  useEffect(() => {
    // Subtle ambient tone per world based on contribution activity
    if (typeof window === "undefined") return;

    let audioContext: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      oscillator = audioContext.createOscillator();
      gainNode = audioContext.createGain();

      const baseFreq = 220;
      const freq = baseFreq + activityScore * 160;
      oscillator.type = "sine";
      oscillator.frequency.value = freq;

      gainNode.gain.value = 0.03 + activityScore * 0.07;

      oscillator.connect(gainNode).connect(audioContext.destination);
      oscillator.start();
    } catch {
      // If the browser blocks audio without interaction, fail silently
    }

    return () => {
      if (oscillator) {
        try {
          oscillator.stop();
        } catch {
          // ignore
        }
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [activityScore]);

  useFrame(({ camera }, delta) => {
    if (!controlsRef.current) return;

    const selfPeer = peers.find((p) => p.id === "self");
    const targetX = selfPeer ? selfPeer.x : centerX;
    const targetZ = selfPeer ? selfPeer.z : centerZ;
    const targetY = getTileHeightAt(targetX, targetZ) + 0.9;

    const desiredTarget = new THREE.Vector3(targetX, targetY, targetZ);

    if (!cameraTargetRef.current) {
      cameraTargetRef.current = desiredTarget.clone();
    }

    // When the user is not dragging/zooming, keep the camera smoothly
    // focused on the local player. While interacting, don't fight OrbitControls
    // so zoom and rotation feel responsive.
    if (!userInteractingRef.current) {
      const currentTarget = cameraTargetRef.current;
      const followStrength = 0.08 * (delta * 60);
      currentTarget.lerp(desiredTarget, followStrength);
      cameraTargetRef.current = currentTarget;
      controlsRef.current.target.copy(currentTarget);

      const offsetDistance = 10;
      const heightOffset = 6;
      const angle = Math.PI / 4;

      const desiredCameraPos = new THREE.Vector3(
        currentTarget.x + offsetDistance * Math.sin(angle),
        currentTarget.y + heightOffset,
        currentTarget.z + offsetDistance * Math.cos(angle),
      );

      const cameraLerpStrength = 0.06 * (delta * 60);
      camera.position.lerp(desiredCameraPos, cameraLerpStrength);
      camera.lookAt(currentTarget);
    } else {
      // Lightly keep the target near the player while the user orbits/zooms
      const currentTarget = cameraTargetRef.current;
      const softFollowStrength = 0.02 * (delta * 60);
      currentTarget.lerp(desiredTarget, softFollowStrength);
      cameraTargetRef.current = currentTarget;
    }
  });

  const selfPeer = peers.find((p) => p.id === "self");

  const handleAvatarClick = (peerId: string) => {
    if (!selfPeer || peerId === "self") return;
    const target = peers.find((p) => p.id === peerId);
    if (!target) return;

    const dx = target.x - selfPeer.x;
    const dz = target.z - selfPeer.z;
    const distance = Math.hypot(dx, dz);

    if (distance > 3.5) return;

    setSelectedPeerId((current) => (current === peerId ? null : peerId));
  };

  const isInteractionLockedForPeer = (peerId: string) => {
    if (monsterPair) {
      return monsterPair.baseId !== peerId;
    }
    if (dancePeerId) {
      return dancePeerId !== peerId;
    }
    return false;
  };

  const triggerDance = (peerId: string) => {
    // Prevent starting a new dance if a monster stack is active with another base
    if (monsterPair && monsterPair.baseId !== peerId) return;

    const locked = isInteractionLockedForPeer(peerId);
    if (locked) return;

    setDancePeerId((current) => {
      const next = current === peerId ? null : peerId;
      return next;
    });

    setSelectedPeerId(null);
  };

  const MonsterPositionalAudio = ({
    peerAudio,
  }: {
    peerAudio?: Record<string, MediaStream | undefined>;
  }) => {
    const { camera, scene } = useThree();
    const listenerRef = useRef<THREE.AudioListener | null>(null);
    const positionalAudioRef = useRef<THREE.PositionalAudio | null>(null);

    // Initialize listener and positional audio node
    useEffect(() => {
      if (!listenerRef.current) {
        const listener = new THREE.AudioListener();
        camera.add(listener);
        listenerRef.current = listener;
      }

      if (!positionalAudioRef.current && listenerRef.current) {
        const positional = new THREE.PositionalAudio(listenerRef.current);
        positional.setRefDistance(4);
        positional.setRolloffFactor(1.5);
        positional.setDistanceModel("inverse");
        scene.add(positional);
        positionalAudioRef.current = positional;
      }

      return () => {
        if (positionalAudioRef.current) {
          scene.remove(positionalAudioRef.current);
          positionalAudioRef.current.stop();
          positionalAudioRef.current = null;
        }
        if (listenerRef.current) {
          camera.remove(listenerRef.current);
          listenerRef.current = null;
        }
      };
    }, [camera, scene]);

    // Attach the correct MediaStream to the positional audio when monster mode is active
    useEffect(() => {
      if (!monsterPair?.baseId || !peerAudio || !positionalAudioRef.current) return;
      const stream = peerAudio[monsterPair.baseId];
      if (!stream) return;

      const positional: any = positionalAudioRef.current;
      if (typeof positional.setMediaStreamSource === "function") {
        positional.setMediaStreamSource(stream);
      }
    }, [monsterPair, peerAudio]);

    // Keep the positional audio node at the monster base position so voice feels like it
    // comes from the combined monster
    useFrame(() => {
      if (!monsterPair?.baseId || !positionalAudioRef.current) return;
      const base = peers.find((p) => p.id === monsterPair.baseId);
      if (!base) return;

      const tileHeight = getTileHeightAt(base.x, base.z);
      positionalAudioRef.current.position.set(base.x, tileHeight + 1.6, base.z);
    });

    return null;
  };

  const toggleMonsterStack = (peerId: string) => {
    // Prevent stacking if a dance is active with someone else
    if (dancePeerId && dancePeerId !== peerId) return;

    const locked = isInteractionLockedForPeer(peerId);
    if (locked && (!monsterPair || monsterPair.baseId !== peerId)) return;

    setMonsterPair((current) => {
      if (current && current.baseId === peerId) return null;
      if (current) return current; // another monster already active
      const next = {
        baseId: peerId,
        riderId: "self",
      } as const;

      // Auto-clear monster mode after 5 seconds
      setTimeout(() => {
        setMonsterPair((inner) => (inner && inner.baseId === peerId ? null : inner));
        setSelectedPeerId(null);
        setDancePeerId(null);
      }, 5000);

      return next;
    });

    setSelectedPeerId(null);
  };
  return (
    <>
      <color attach="background" args={[0x020511]} />

      <ambientLight intensity={0.3 + activityScore * 0.2} />
      <directionalLight
        position={[6, 12, 6]}
        intensity={1.1 + activityScore * 0.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -0.05, 0]}
        receiveShadow
        scale={[groundSizeX, groundSizeZ, 1]}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={new THREE.Color(0x020915)} />
      </mesh>

      {tiles.map((tile) => {
        const [r, g, b] = levelColor[tile.level];
        return (
          <mesh
            key={`${tile.x}-${tile.z}`}
            position={[offsetX + tile.x * tileSize, tile.height / 2, offsetZ + tile.z * tileSize]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[tileSize * 0.94, tile.height, tileSize * 0.94]} />
            <meshStandardMaterial color={new THREE.Color(r, g, b)} />
          </mesh>
        );
      })}

      {contributionMeta && (
        <>
          <Html
            position={[
              contributionMeta.startPos.worldX,
              getTileHeightAt(contributionMeta.startPos.worldX, contributionMeta.startPos.worldZ) + 1.1,
              contributionMeta.startPos.worldZ,
            ]}
            center
          >
            <div className="animate-enter hover-scale rounded-sm border border-border bg-background/95 px-3 py-2 text-[11px] shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Start
              </p>
            </div>
          </Html>

          <Html
            position={[
              contributionMeta.endPos.worldX,
              getTileHeightAt(contributionMeta.endPos.worldX, contributionMeta.endPos.worldZ) + 1.1,
              contributionMeta.endPos.worldZ,
            ]}
            center
          >
            <div className="animate-enter hover-scale rounded-sm border border-border bg-background/95 px-3 py-2 text-[11px] shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                End
              </p>
            </div>
          </Html>
        </>
      )}

      {peers.map((peer) => {
        const isSelf = peer.id === "self";
        const isMonsterBase = monsterPair?.baseId === peer.id;
        const isMonsterRider = monsterPair?.riderId === peer.id;

        let displayX = peer.x;
        let displayZ = peer.z;

        if (isMonsterRider && monsterPair) {
          const base = peers.find((p) => p.id === monsterPair.baseId);
          if (base) {
            displayX = base.x;
            displayZ = base.z;
          }
        }

        const tileHeight = getTileHeightAt(displayX, displayZ);
        const avatarY = tileHeight - 0.05 + (isMonsterRider ? 1.5 : 0);

        const isNearSelf =
          !!selfPeer && !isSelf
            ? Math.hypot(displayX - selfPeer.x, displayZ - selfPeer.z) <= 3.5
            : false;

        const showMenu = !isSelf && isNearSelf && selectedPeerId === peer.id;
        const locked = isInteractionLockedForPeer(peer.id);

        return (
          <group key={peer.id}>
            <Avatar
              x={displayX}
              z={displayZ}
              y={avatarY}
              name={peer.name}
              isMoving={peer.isMoving}
              isRunning={peer.isRunning}
              heading={peer.heading ?? 0}
              speed={peer.speed ?? 0}
              showLabel={peer.id !== "self"}
              scale={isMonsterBase ? 1.3 : 0.6}
              isDancing={dancePeerId === peer.id || (dancePeerId && peer.id === "self") ? true : false}
              skinTier={peer.skinTier}
              onClick={() => handleAvatarClick(peer.id)}
            />

            {showMenu && (
              <Html position={[displayX, avatarY + (isMonsterBase ? 3.8 : 2.4), displayZ]} center>
                <div className="flex flex-col items-center gap-1 rounded-sm border border-border bg-background/95 px-1.5 py-1 text-[10px] shadow-xs">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerDance(peer.id);
                      }}
                    >
                      <PartyPopper className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Let&apos;s dance</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMonsterStack(peer.id);
                      }}
                    >
                      <Bot className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Become monsters</span>
                    </Button>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
      <MonsterPositionalAudio peerAudio={peerAudio} />

      <OrbitControls
        ref={controlsRef}
        onStart={() => {
          userInteractingRef.current = true;
        }}
        onEnd={() => {
          userInteractingRef.current = false;
        }}
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
};

export const HeatmapScene = ({ username, peers, contributions, peerAudio }: HeatmapSceneProps) => {
  return (
    <Canvas
      shadows
      camera={{ position: [14, 12, 14], fov: 45, near: 0.1, far: 80 }}
      className="h-full w-full"
    >
      <HeatmapWorld username={username} peers={peers} contributions={contributions} peerAudio={peerAudio} />
    </Canvas>
  );
};
