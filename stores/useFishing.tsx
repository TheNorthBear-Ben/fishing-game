import { create } from "zustand";

export type FishType = {
  id: string;
  name: string;
  color: string;
  size: number;
  speed: number;
  rarity: "common" | "uncommon" | "rare";
};

export type FishState = "idle" | "roaming" | "curious" | "approaching" | "nibbling" | "retreating" | "biting" | "circling";

export type Fish = {
  id: string;
  type: FishType;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  smoothAngle: number;
  isInterested: boolean;
  fishState: FishState;
  stateStartTime: number;
  nibbleCount: number;
  maxNibbles: number;
  circleAngle: number;
  circleCenterX: number;
  circleCenterY: number;
  retreatStartX: number;
  retreatStartY: number;
  wildness: number;
  biteDuration: number;
};

export type GamePhase = "idle" | "positioning" | "casting" | "waiting" | "nibbling" | "biting" | "caught" | "missed";

interface FishingState {
  phase: GamePhase;
  bobberX: number;
  bobberY: number;
  bobberTargetX: number;
  bobberTargetY: number;
  bobberDepth: number;
  fishes: Fish[];
  interestedFishId: string | null;
  caughtFish: FishType | null;
  caughtFishSize: number;
  showCatchPopup: boolean;
  castProgress: number;
  castTime: number;

  setPhase: (phase: GamePhase) => void;
  setBobberPosition: (x: number, y: number) => void;
  setBobberTarget: (x: number, y: number) => void;
  setBobberDepth: (depth: number) => void;
  setFishes: (fishes: Fish[]) => void;
  setInterestedFishId: (fishId: string | null) => void;
  setCaughtFish: (fish: FishType | null) => void;
  setShowCatchPopup: (show: boolean) => void;
  setCastProgress: (progress: number) => void;
  setCastTime: (time: number) => void;
  castLine: () => void;
  reelIn: () => void;
  resetGame: () => void;
  getInterestedFish: () => Fish | undefined;
}

const FISH_TYPES: FishType[] = [
  { id: "karpfen", name: "Karpfen", color: "rgba(20, 35, 55, 1)", size: 35, speed: 0.8, rarity: "common" },
  { id: "forelle", name: "Forelle", color: "rgba(15, 30, 50, 1)", size: 28, speed: 1.2, rarity: "common" },
  { id: "barsch", name: "Barsch", color: "rgba(25, 40, 60, 1)", size: 22, speed: 1.0, rarity: "common" },
  { id: "hecht", name: "Hecht", color: "rgba(18, 32, 52, 1)", size: 45, speed: 1.5, rarity: "uncommon" },
  { id: "wels", name: "Wels", color: "rgba(12, 25, 45, 1)", size: 55, speed: 0.6, rarity: "rare" },
  { id: "zander", name: "Zander", color: "rgba(22, 38, 58, 1)", size: 38, speed: 1.1, rarity: "uncommon" },
];

type WellBounds = {
  centerX: number;
  centerY: number;
  innerRadius: number;
};

const generateFish = (count: number, canvasWidth: number, canvasHeight: number, wellBounds?: WellBounds): Fish[] => {
  const fishes: Fish[] = [];
  for (let i = 0; i < count; i++) {
    const baseType = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)];
    const sizeScale = wellBounds ? 0.22 + Math.random() * 0.1 : 1;
    const type = {
      ...baseType,
      size: baseType.size * sizeScale,
    };
    
    let x: number, y: number;
    if (wellBounds) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (wellBounds.innerRadius - type.size - 10);
      x = wellBounds.centerX + Math.cos(angle) * dist;
      y = wellBounds.centerY + Math.sin(angle) * dist;
    } else {
      x = Math.random() * canvasWidth;
      y = Math.random() * canvasHeight;
    }
    
    const fishAngle = Math.random() * Math.PI * 2;
    const wildness = 0.5 + Math.random() * 1.5;
    const biteDuration = 1500 + Math.random() * 2000;
    
    let targetX: number, targetY: number;
    if (wellBounds) {
      const targetAngle = Math.random() * Math.PI * 2;
      const targetDist = Math.random() * (wellBounds.innerRadius - type.size - 10);
      targetX = wellBounds.centerX + Math.cos(targetAngle) * targetDist;
      targetY = wellBounds.centerY + Math.sin(targetAngle) * targetDist;
    } else {
      targetX = -100 + Math.random() * (canvasWidth + 200);
      targetY = -100 + Math.random() * (canvasHeight + 200);
    }
    
    fishes.push({
      id: `fish-${i}-${Date.now()}`,
      type,
      x,
      y,
      targetX,
      targetY,
      angle: fishAngle,
      smoothAngle: fishAngle,
      isInterested: false,
      fishState: "roaming",
      stateStartTime: Date.now(),
      nibbleCount: 0,
      maxNibbles: 2 + Math.floor(Math.random() * 4),
      circleAngle: 0,
      circleCenterX: 0,
      circleCenterY: 0,
      retreatStartX: x,
      retreatStartY: y,
      wildness,
      biteDuration,
    });
  }
  return fishes;
};

export const useFishing = create<FishingState>((set, get) => ({
  phase: "idle",
  bobberX: 0,
  bobberY: 0,
  bobberTargetX: 0,
  bobberTargetY: 0,
  bobberDepth: 0,
  fishes: [],
  interestedFishId: null,
  caughtFish: null,
  caughtFishSize: 0,
  showCatchPopup: false,
  castProgress: 0,
  castTime: 0,

  setPhase: (phase) => set({ phase }),
  setBobberPosition: (x, y) => set({ bobberX: x, bobberY: y }),
  setBobberTarget: (x, y) => set({ bobberTargetX: x, bobberTargetY: y }),
  setBobberDepth: (depth) => set({ bobberDepth: Math.max(0, Math.min(1, depth)) }),
  setFishes: (fishes) => set({ fishes }),
  setInterestedFishId: (fishId) => set({ interestedFishId: fishId }),
  setCaughtFish: (fish) => set({ caughtFish: fish }),
  setShowCatchPopup: (show) => set({ showCatchPopup: show }),
  setCastProgress: (progress) => set({ castProgress: progress }),
  setCastTime: (time) => set({ castTime: time }),

  getInterestedFish: () => {
    const { fishes, interestedFishId } = get();
    return fishes.find((f) => f.id === interestedFishId);
  },

  castLine: () => {
    const { bobberTargetX, bobberTargetY } = get();
    set({
      phase: "casting",
      bobberX: bobberTargetX,
      bobberY: bobberTargetY,
      bobberDepth: 0,
      interestedFishId: null,
      castProgress: 0,
      castTime: Date.now(),
    });
    
    let progress = 0;
    const animateCast = () => {
      progress += 0.05;
      set({ castProgress: Math.min(1, progress) });
      if (progress < 1) {
        requestAnimationFrame(animateCast);
      } else {
        set({ phase: "waiting", castProgress: 1 });
      }
    };
    requestAnimationFrame(animateCast);
  },

  reelIn: () => {
    const { phase, bobberDepth, fishes, interestedFishId } = get();
    const interestedFish = fishes.find((f) => f.id === interestedFishId);
    if (phase === "biting" && bobberDepth > 0.5 && interestedFish) {
      const fishSize = Math.round(interestedFish.type.size * 0.8 + Math.random() * interestedFish.type.size * 0.4);
      set({
        phase: "caught",
        caughtFish: interestedFish.type,
        caughtFishSize: fishSize,
        showCatchPopup: true,
        interestedFishId: null,
      });
    } else if (phase === "waiting" || phase === "nibbling" || phase === "biting") {
      set({
        phase: "missed",
        interestedFishId: null,
        bobberDepth: 0,
      });
      setTimeout(() => {
        set({ phase: "idle" });
      }, 1000);
    }
  },

  resetGame: () => {
    set({
      phase: "idle",
      bobberX: 0,
      bobberY: 0,
      bobberDepth: 0,
      interestedFishId: null,
      caughtFish: null,
      caughtFishSize: 0,
      showCatchPopup: false,
      castProgress: 0,
      castTime: 0,
    });
  },
}));

export { generateFish, FISH_TYPES };
export type { WellBounds };
