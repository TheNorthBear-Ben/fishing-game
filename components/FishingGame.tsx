import { useEffect, useRef, useState, useCallback } from "react";
import { useFishing, generateFish, Fish, FishState } from "@/lib/stores/useFishing";
import { CatchPopup } from "./CatchPopup";
import { Globe, MapPin, BarChart3, Fish as FishIcon } from "lucide-react";

const triggerHaptic = (type: "light" | "medium" | "heavy" | "success" | "warning") => {
  if (!navigator.vibrate) return;
  
  switch (type) {
    case "light":
      navigator.vibrate(10);
      break;
    case "medium":
      navigator.vibrate(25);
      break;
    case "heavy":
      navigator.vibrate(50);
      break;
    case "success":
      navigator.vibrate([50, 50, 100]);
      break;
    case "warning":
      navigator.vibrate([30, 30, 30, 30, 30]);
      break;
  }
};

const CURIOSITY_DELAY = 3000;
const APPROACH_SPEED = 0.3;
const NIBBLE_DURATION = 400;
const RETREAT_DURATION = 800;
const RETREAT_DISTANCE = 45;
const CIRCLE_RADIUS = 35;
const CIRCLE_SPEED = 2.5;

type BubbleParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
};

export function FishingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const splashParticlesRef = useRef<Array<{x: number, y: number, vx: number, vy: number, life: number, size: number}>>([]);
  const bubbleParticlesRef = useRef<BubbleParticle[]>([]);
  const prevPhaseRef = useRef<string>("");
  const bobberImageRef = useRef<HTMLImageElement | null>(null);
  const wellImageRef = useRef<HTMLImageElement | null>(null);
  const [bobberImageLoaded, setBobberImageLoaded] = useState(false);
  const [wellImageLoaded, setWellImageLoaded] = useState(false);
  const wellBoundsRef = useRef<{ centerX: number; centerY: number; outerRadius: number; innerRadius: number } | null>(null);
  const [missedWellMessage, setMissedWellMessage] = useState(false);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const bobberImg = new Image();
    bobberImg.onload = () => {
      bobberImageRef.current = bobberImg;
      setBobberImageLoaded(true);
    };
    bobberImg.src = "/bobber.png";

    const wellImg = new Image();
    wellImg.onload = () => {
      wellImageRef.current = wellImg;
      setWellImageLoaded(true);
    };
    wellImg.src = "/well.png";
  }, []);

  const {
    phase,
    bobberX,
    bobberY,
    bobberTargetX,
    bobberTargetY,
    bobberDepth,
    fishes,
    castProgress,
    castTime,
    showCatchPopup,
    setPhase,
    setBobberPosition,
    setBobberTarget,
    setBobberDepth,
    setFishes,
    setInterestedFishId,
    castLine,
    reelIn,
    resetGame,
    setShowCatchPopup,
  } = useFishing();

  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      if (phase === "casting") {
        triggerHaptic("medium");
      } else if (phase === "nibbling" && prevPhaseRef.current === "waiting") {
        triggerHaptic("light");
      } else if (phase === "biting") {
        triggerHaptic("warning");
      } else if (phase === "caught") {
        triggerHaptic("success");
      } else if (phase === "missed") {
        triggerHaptic("heavy");
      }
      prevPhaseRef.current = phase;
    }
  }, [phase]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && wellImageRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
        
        const wellSize = Math.min(width * 0.95, height * 0.85);
        const wellCenterX = width / 2;
        const wellCenterY = height / 2 + 70;
        const outerRadius = wellSize / 2;
        const innerRadius = outerRadius * 0.58;
        
        wellBoundsRef.current = { centerX: wellCenterX, centerY: wellCenterY, outerRadius, innerRadius };
        
        if (fishes.length === 0) {
          const wellBounds = { centerX: wellCenterX, centerY: wellCenterY, innerRadius };
          setFishes(generateFish(3, width, height, wellBounds));
          setBobberTarget(wellCenterX, wellCenterY);
        }
      } else if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [wellImageLoaded]);

  useEffect(() => {
    if (phase === "casting" && castProgress >= 0.95) {
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
        splashParticlesRef.current.push({
          x: bobberX,
          y: bobberY,
          vx: Math.cos(angle) * (2 + Math.random() * 3),
          vy: Math.sin(angle) * (2 + Math.random() * 3) - 2,
          life: 1,
          size: 3 + Math.random() * 4,
        });
      }
    }
  }, [castProgress, phase, bobberX, bobberY]);

  const updateFishState = (fish: Fish, now: number, bobberX: number, bobberY: number, currentPhase: string, interestedFishId: string | null, castTime: number): Fish => {
    const timeSinceState = now - fish.stateStartTime;
    const distToBobber = Math.sqrt((fish.x - bobberX) ** 2 + (fish.y - bobberY) ** 2);
    
    let newState: FishState = fish.fishState;
    let newNibbleCount = fish.nibbleCount;
    let newRetreatStartX = fish.retreatStartX;
    let newRetreatStartY = fish.retreatStartY;
    let newCircleAngle = fish.circleAngle;
    let newCircleCenterX = fish.circleCenterX;
    let newCircleCenterY = fish.circleCenterY;
    let stateStartTime = fish.stateStartTime;

    const isWaitingPhase = currentPhase === "waiting" || currentPhase === "nibbling" || currentPhase === "biting";
    const timeSinceCast = now - castTime;

    if (!isWaitingPhase && fish.fishState !== "roaming" && fish.fishState !== "idle") {
      newState = "roaming";
      stateStartTime = now;
      newNibbleCount = 0;
    }

    switch (fish.fishState) {
      case "idle":
        if (timeSinceState > 6000 + Math.random() * 6000) {
          newState = "roaming";
          stateStartTime = now;
        }
        break;

      case "roaming":
        if (isWaitingPhase && !interestedFishId && timeSinceCast > CURIOSITY_DELAY && distToBobber < 250) {
          if (Math.random() < 0.005) {
            newState = "curious";
            stateStartTime = now;
          }
        }
        break;

      case "curious":
        if (timeSinceState > 2000 + Math.random() * 2000) {
          newState = "approaching";
          stateStartTime = now;
        }
        break;

      case "approaching": {
        const mouthOffsetX = Math.cos(fish.angle) * fish.type.size * 0.6;
        const mouthOffsetY = Math.sin(fish.angle) * fish.type.size * 0.6;
        const mouthX = fish.x + mouthOffsetX;
        const mouthY = fish.y + mouthOffsetY;
        const mouthDist = Math.sqrt((mouthX - bobberX) ** 2 + (mouthY - bobberY) ** 2);
        if (mouthDist < 20) {
          newState = "nibbling";
          stateStartTime = now;
          triggerHaptic("light");
        }
        break;
      }

      case "nibbling":
        if (timeSinceState > NIBBLE_DURATION) {
          newRetreatStartX = fish.x;
          newRetreatStartY = fish.y;
          newState = "retreating";
          stateStartTime = now;
          newNibbleCount++;
        }
        break;

      case "retreating":
        if (timeSinceState > RETREAT_DURATION) {
          if (newNibbleCount >= fish.maxNibbles) {
            newState = "biting";
            stateStartTime = now;
            newCircleAngle = Math.atan2(fish.y - bobberY, fish.x - bobberX);
            newCircleCenterX = bobberX;
            newCircleCenterY = bobberY;
            triggerHaptic("warning");
          } else {
            newState = "approaching";
            stateStartTime = now;
          }
        }
        break;

      case "biting":
        newState = "circling";
        stateStartTime = now;
        break;

      case "circling":
        if (timeSinceState > fish.biteDuration) {
          newState = "roaming";
          stateStartTime = now;
          newNibbleCount = 0;
        }
        break;
    }

    return {
      ...fish,
      fishState: newState,
      stateStartTime,
      nibbleCount: newNibbleCount,
      retreatStartX: newRetreatStartX,
      retreatStartY: newRetreatStartY,
      circleAngle: newCircleAngle,
      circleCenterX: newCircleCenterX,
      circleCenterY: newCircleCenterY,
    };
  };

  const updateFishPosition = (fish: Fish, deltaTime: number, now: number, bobberX: number, bobberY: number, width: number, height: number): Fish => {
    let { x, y, targetX, targetY, angle, smoothAngle, circleAngle } = fish;
    const baseSpeed = fish.type.speed * deltaTime * 0.03;

    switch (fish.fishState) {
      case "idle":
        break;

      case "roaming":
      case "curious": {
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
          x += (dx / dist) * baseSpeed;
          y += (dy / dist) * baseSpeed;
          angle = Math.atan2(dy, dx);
        } else {
          if (wellBoundsRef.current) {
            const well = wellBoundsRef.current;
            const newAngle = Math.random() * Math.PI * 2;
            const canSwimOutside = Math.random() < 0.3;
            const maxDist = canSwimOutside 
              ? well.innerRadius * 1.5 
              : well.innerRadius - fish.type.size - 10;
            const newDist = Math.random() * maxDist;
            targetX = well.centerX + Math.cos(newAngle) * newDist;
            targetY = well.centerY + Math.sin(newAngle) * newDist;
          } else {
            targetX = -100 + Math.random() * (width + 200);
            targetY = -100 + Math.random() * (height + 200);
          }
        }
        
        break;
      }

      case "approaching": {
        const mouthOffsetX = Math.cos(angle) * fish.type.size * 0.6;
        const mouthOffsetY = Math.sin(angle) * fish.type.size * 0.6;
        const mouthX = x + mouthOffsetX;
        const mouthY = y + mouthOffsetY;
        const dx = bobberX - mouthX;
        const dy = bobberY - mouthY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
          const speed = APPROACH_SPEED * deltaTime * 0.1;
          x += (dx / dist) * speed;
          y += (dy / dist) * speed;
          angle = Math.atan2(dy, dx);
        }
        break;
      }

      case "nibbling": {
        const dx = bobberX - x;
        const dy = bobberY - y;
        angle = Math.atan2(dy, dx);
        break;
      }

      case "retreating": {
        const progress = Math.min(1, (now - fish.stateStartTime) / RETREAT_DURATION);
        const easeProgress = 1 - Math.pow(1 - progress, 2);
        
        const retreatDirX = fish.retreatStartX - bobberX;
        const retreatDirY = fish.retreatStartY - bobberY;
        const retreatDist = Math.sqrt(retreatDirX * retreatDirX + retreatDirY * retreatDirY);
        
        if (retreatDist > 0) {
          const normalizedX = retreatDirX / retreatDist;
          const normalizedY = retreatDirY / retreatDist;
          
          x = fish.retreatStartX + normalizedX * RETREAT_DISTANCE * easeProgress;
          y = fish.retreatStartY + normalizedY * RETREAT_DISTANCE * easeProgress;
          angle = Math.atan2(-normalizedY, -normalizedX);
        }
        break;
      }

      case "biting":
      case "circling": {
        const fishCircleSpeed = CIRCLE_SPEED * fish.wildness;
        circleAngle += fishCircleSpeed * deltaTime * 0.001;
        x = fish.circleCenterX + Math.cos(circleAngle) * CIRCLE_RADIUS;
        y = fish.circleCenterY + Math.sin(circleAngle) * CIRCLE_RADIUS;
        angle = circleAngle + Math.PI / 2;
        break;
      }
    }

    if (wellBoundsRef.current && fish.fishState !== "roaming" && fish.fishState !== "curious") {
      const well = wellBoundsRef.current;
      const distFromCenter = Math.sqrt((x - well.centerX) ** 2 + (y - well.centerY) ** 2);
      const maxDist = well.innerRadius - fish.type.size - 5;
      if (distFromCenter > maxDist && maxDist > 0) {
        const angleFromCenter = Math.atan2(y - well.centerY, x - well.centerX);
        x = well.centerX + Math.cos(angleFromCenter) * maxDist;
        y = well.centerY + Math.sin(angleFromCenter) * maxDist;
      }
    }

    const angleDiff = ((angle - smoothAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    smoothAngle += angleDiff * 0.1;

    return { ...fish, x, y, targetX, targetY, angle, smoothAngle, circleAngle };
  };

  const applyFishSeparation = (fishList: Fish[]): Fish[] => {
    const SEPARATION_BUFFER = 8;
    const MAX_PUSH = 2;
    
    return fishList.map((fish, i) => {
      let pushX = 0;
      let pushY = 0;
      
      for (let j = 0; j < fishList.length; j++) {
        if (i === j) continue;
        
        const other = fishList[j];
        const dx = fish.x - other.x;
        const dy = fish.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = fish.type.size + other.type.size + SEPARATION_BUFFER;
        
        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const pushStrength = Math.min(overlap * 0.5, MAX_PUSH);
          pushX += (dx / dist) * pushStrength;
          pushY += (dy / dist) * pushStrength;
        }
      }
      
      const stateWeight = (fish.fishState === "roaming" || fish.fishState === "curious") ? 1.0 :
                          (fish.fishState === "approaching" || fish.fishState === "nibbling") ? 0.3 : 0.5;
      
      return {
        ...fish,
        x: fish.x + pushX * stateWeight,
        y: fish.y + pushY * stateWeight,
      };
    });
  };

  const updateFishes = useCallback((deltaTime: number, now: number) => {
    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    const currentState = useFishing.getState();
    const currentPhase = currentState.phase;
    const currentInterestedFishId = currentState.interestedFishId;
    const currentCastTime = currentState.castTime;
    const currentBobberX = currentState.bobberX;
    const currentBobberY = currentState.bobberY;

    let newInterestedFishId = currentInterestedFishId;

    let updatedFishes = fishes.map((fish) => {
      let updatedFish = updateFishState(fish, now, currentBobberX, currentBobberY, currentPhase, currentInterestedFishId, currentCastTime);
      updatedFish = updateFishPosition(updatedFish, deltaTime, now, currentBobberX, currentBobberY, width, height);

      if (!currentInterestedFishId && (updatedFish.fishState === "approaching" || updatedFish.fishState === "curious")) {
        newInterestedFishId = updatedFish.id;
        updatedFish.isInterested = true;
      }

      if (updatedFish.id === currentInterestedFishId) {
        updatedFish.isInterested = true;
      }

      return updatedFish;
    });

    updatedFishes = applyFishSeparation(updatedFishes);

    if (newInterestedFishId !== currentInterestedFishId) {
      setInterestedFishId(newInterestedFishId);
    }

    setFishes(updatedFishes);
  }, [fishes, dimensions]);

  const handleGamePhaseUpdates = useCallback(() => {
    const currentState = useFishing.getState();
    const interestedFish = currentState.fishes.find((f) => f.id === currentState.interestedFishId);
    const currentPhase = currentState.phase;

    if (!interestedFish) return;

    if (interestedFish.fishState === "nibbling" && currentPhase === "waiting") {
      setPhase("nibbling");
      setBobberDepth(0.3);
    } else if (interestedFish.fishState === "retreating" && currentPhase === "nibbling") {
      setBobberDepth(0);
    } else if (interestedFish.fishState === "approaching" && currentPhase === "nibbling") {
      setPhase("waiting");
    } else if ((interestedFish.fishState === "biting" || interestedFish.fishState === "circling") && currentPhase !== "biting") {
      setPhase("biting");
      setBobberDepth(0.8);
    }

    if (interestedFish.fishState === "circling") {
      const wobbleX = Math.sin(Date.now() * 0.02) * 3;
      const wobbleY = Math.cos(Date.now() * 0.025) * 2;
      setBobberPosition(
        interestedFish.x + Math.cos(interestedFish.smoothAngle) * interestedFish.type.size * 0.8 + wobbleX,
        interestedFish.y + Math.sin(interestedFish.smoothAngle) * interestedFish.type.size * 0.4 + wobbleY
      );
      
      if (Math.random() < 0.3) {
        bubbleParticlesRef.current.push({
          x: interestedFish.x + (Math.random() - 0.5) * 30,
          y: interestedFish.y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 2,
          vy: -1 - Math.random() * 2,
          size: 2 + Math.random() * 4,
          life: 1,
          maxLife: 1,
        });
      }
      
      if (Math.random() < 0.15) {
        const splashAngle = Math.random() * Math.PI * 2;
        splashParticlesRef.current.push({
          x: interestedFish.x,
          y: interestedFish.y,
          vx: Math.cos(splashAngle) * (2 + Math.random() * 3),
          vy: Math.sin(splashAngle) * 2 - 3,
          life: 1,
          size: 3 + Math.random() * 4,
        });
      }
    }

    if (interestedFish.fishState === "roaming" && (currentPhase === "nibbling" || currentPhase === "biting")) {
      setPhase("waiting");
      setBobberDepth(0);
      setInterestedFishId(null);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = (time: number) => {
      const deltaTime = Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;
      const now = Date.now();

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);

      const bgGradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);
      bgGradient.addColorStop(0, "rgb(245, 248, 252)");
      bgGradient.addColorStop(0.5, "rgb(235, 240, 248)");
      bgGradient.addColorStop(1, "rgb(225, 232, 242)");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      const currentFishes = useFishing.getState().fishes;
      
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2 + 70;
      
      const drawRipple = (originX: number, originY: number, startTime: number, maxRadius: number, ringCount: number, baseAlpha: number) => {
        const age = (time - startTime) * 0.001;
        const waveSpeed = 35;
        
        for (let ring = 0; ring < ringCount; ring++) {
          const ringOffset = ring * 30;
          const radius = (age * waveSpeed + ringOffset) % maxRadius;
          
          if (radius < 15) continue;
          
          const fadeIn = Math.min(1, radius / 40);
          const fadeOut = 1 - (radius / maxRadius);
          const alpha = baseAlpha * fadeIn * fadeOut * fadeOut;
          
          if (alpha < 0.01) continue;
          
          const wobble = Math.sin(time * 0.0008 + ring * 0.5) * 0.015;
          const scaleX = 1.0 + wobble;
          const scaleY = 1.0 - wobble * 0.5;
          
          ctx.save();
          ctx.translate(originX, originY);
          ctx.scale(scaleX, scaleY);
          
          const ringWidth = 12 + fadeOut * 8;
          const innerRadius = Math.max(1, radius - ringWidth / 2);
          const outerRadius = Math.max(innerRadius + 1, radius + ringWidth / 2);
          
          if (!isFinite(innerRadius) || !isFinite(outerRadius)) continue;
          
          const gradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
          gradient.addColorStop(0, `rgba(200, 210, 225, 0)`);
          gradient.addColorStop(0.3, `rgba(180, 195, 215, ${alpha * 0.7})`);
          gradient.addColorStop(0.5, `rgba(170, 185, 205, ${alpha})`);
          gradient.addColorStop(0.7, `rgba(180, 195, 215, ${alpha * 0.7})`);
          gradient.addColorStop(1, `rgba(200, 210, 225, 0)`);
          
          ctx.beginPath();
          ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
          ctx.arc(0, 0, innerRadius, 0, Math.PI * 2, true);
          ctx.fillStyle = gradient;
          ctx.fill();
          
          if (ring % 2 === 0 && radius > 5) {
            const hlInner = Math.max(1, radius - 2);
            const hlOuter = radius + 4;
            if (isFinite(hlInner) && isFinite(hlOuter) && hlOuter > hlInner) {
              const highlightGradient = ctx.createRadialGradient(0, 0, hlInner, 0, 0, hlOuter);
              highlightGradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
              highlightGradient.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.4})`);
              highlightGradient.addColorStop(0.6, `rgba(255, 255, 255, ${alpha * 0.4})`);
              highlightGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
              
              ctx.beginPath();
              ctx.arc(0, 0, hlOuter, 0, Math.PI * 2);
              ctx.arc(0, 0, hlInner, 0, Math.PI * 2, true);
              ctx.fillStyle = highlightGradient;
              ctx.fill();
            }
          }
          
          ctx.restore();
        }
      };
      
      const ripple1X = dimensions.width * (0.2 + Math.sin(time * 0.00003) * 0.1);
      const ripple1Y = dimensions.height * (0.25 + Math.cos(time * 0.00004) * 0.1);
      drawRipple(ripple1X, ripple1Y, 0, 250, 5, 0.1);
      
      const ripple2X = dimensions.width * (0.75 + Math.sin(time * 0.00002 + 2) * 0.15);
      const ripple2Y = dimensions.height * (0.7 + Math.cos(time * 0.000025 + 1) * 0.12);
      drawRipple(ripple2X, ripple2Y, 3000, 220, 4, 0.08);
      
      currentFishes.forEach((fish, index) => {
        const isMoving = fish.fishState === "roaming" || fish.fishState === "approaching" || fish.fishState === "circling";
        
        if (isMoving) {
          const fishRippleAlpha = fish.fishState === "circling" ? 0.2 : 0.1;
          drawRipple(fish.x, fish.y, time - 500 - index * 200, 120, 4, fishRippleAlpha);
        }
      });
      
      const renderPhase = useFishing.getState().phase;
      const bobberInWater = renderPhase === "waiting" || renderPhase === "nibbling" || renderPhase === "biting";
      
      if (bobberInWater) {
        const currentBobberX = useFishing.getState().bobberX;
        const currentBobberY = useFishing.getState().bobberY;
        
        const irregularOffset1 = Math.sin(time * 0.0007) * 3;
        const irregularOffset2 = Math.cos(time * 0.0005) * 2;
        
        const bobberRippleAlpha = renderPhase === "biting" ? 0.25 : 
                                   renderPhase === "nibbling" ? 0.18 : 0.12;
        const bobberRingCount = renderPhase === "biting" ? 6 : 4;
        
        drawRipple(
          currentBobberX + irregularOffset1, 
          currentBobberY + irregularOffset2, 
          time - 300, 
          150, 
          bobberRingCount, 
          bobberRippleAlpha
        );
        
        if (renderPhase === "nibbling" || renderPhase === "biting") {
          const extraOffset = Math.sin(time * 0.003) * 5;
          drawRipple(
            currentBobberX + extraOffset, 
            currentBobberY - extraOffset * 0.5, 
            time - 150, 
            80, 
            3, 
            bobberRippleAlpha * 0.7
          );
        }
      }
      
      for (let i = 0; i < 6; i++) {
        const glintX = (Math.sin(time * 0.00008 + i * 2.1) * 0.35 + 0.5) * dimensions.width;
        const glintY = (Math.cos(time * 0.00006 + i * 1.7) * 0.35 + 0.5) * dimensions.height;
        const glintSize = 80 + Math.sin(time * 0.0003 + i) * 30;
        
        const glintGradient = ctx.createRadialGradient(glintX, glintY, 0, glintX, glintY, glintSize);
        glintGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
        glintGradient.addColorStop(0.4, "rgba(255, 255, 255, 0.1)");
        glintGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = glintGradient;
        ctx.beginPath();
        ctx.arc(glintX, glintY, glintSize, 0, Math.PI * 2);
        ctx.fill();
      }

      const currentInterestedFishId = useFishing.getState().interestedFishId;

      if (wellBoundsRef.current && wellImageRef.current) {
        const well = wellBoundsRef.current;
        
        const waterGradient = ctx.createRadialGradient(
          well.centerX, well.centerY, 0,
          well.centerX, well.centerY, well.innerRadius
        );
        waterGradient.addColorStop(0, "rgba(110, 195, 215, 1)");
        waterGradient.addColorStop(0.5, "rgba(90, 180, 205, 1)");
        waterGradient.addColorStop(0.75, "rgba(70, 160, 190, 1)");
        waterGradient.addColorStop(0.9, "rgba(50, 130, 165, 1)");
        waterGradient.addColorStop(1, "rgba(35, 100, 140, 1)");
        ctx.beginPath();
        ctx.arc(well.centerX, well.centerY, well.innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = waterGradient;
        ctx.fill();
        
        const shadowGradient = ctx.createRadialGradient(
          well.centerX, well.centerY, well.innerRadius * 0.85,
          well.centerX, well.centerY, well.innerRadius
        );
        shadowGradient.addColorStop(0, "rgba(30, 80, 120, 0)");
        shadowGradient.addColorStop(0.5, "rgba(25, 70, 110, 0.25)");
        shadowGradient.addColorStop(1, "rgba(20, 60, 100, 0.5)");
        ctx.beginPath();
        ctx.arc(well.centerX, well.centerY, well.innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = shadowGradient;
        ctx.fill();
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(well.centerX, well.centerY, well.innerRadius, 0, Math.PI * 2);
        ctx.clip();
        
        const drawWellRipple = (originX: number, originY: number, startTime: number, maxRadius: number, ringCount: number, baseAlpha: number) => {
          const age = (time - startTime) * 0.001;
          const waveSpeed = 25;
          
          for (let ring = 0; ring < ringCount; ring++) {
            const ringOffset = ring * 20;
            const radius = (age * waveSpeed + ringOffset) % maxRadius;
            
            if (radius < 10) continue;
            
            const fadeIn = Math.min(1, radius / 30);
            const fadeOut = 1 - (radius / maxRadius);
            const alpha = baseAlpha * fadeIn * fadeOut * fadeOut;
            
            if (alpha < 0.01) continue;
            
            const wobble = Math.sin(time * 0.0008 + ring * 0.5) * 0.015;
            const scaleX = 1.0 + wobble;
            const scaleY = 1.0 - wobble * 0.5;
            
            ctx.save();
            ctx.translate(originX, originY);
            ctx.scale(scaleX, scaleY);
            
            const ringWidth = 8 + fadeOut * 6;
            const innerRad = Math.max(1, radius - ringWidth / 2);
            const outerRad = Math.max(innerRad + 1, radius + ringWidth / 2);
            
            if (!isFinite(innerRad) || !isFinite(outerRad)) {
              ctx.restore();
              continue;
            }
            
            const gradient = ctx.createRadialGradient(0, 0, innerRad, 0, 0, outerRad);
            gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
            gradient.addColorStop(0.3, `rgba(200, 240, 255, ${alpha * 0.7})`);
            gradient.addColorStop(0.5, `rgba(230, 250, 255, ${alpha})`);
            gradient.addColorStop(0.7, `rgba(200, 240, 255, ${alpha * 0.7})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
            
            ctx.beginPath();
            ctx.arc(0, 0, outerRad, 0, Math.PI * 2);
            ctx.arc(0, 0, innerRad, 0, Math.PI * 2, true);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.restore();
          }
        };
        
        for (let i = 0; i < 25; i++) {
          const dotAngle = (i * 0.52) + Math.sin(time * 0.00008 + i * 0.7) * 0.05;
          const dotDist = well.innerRadius * (0.15 + (i % 7) * 0.11);
          const dotX = well.centerX + Math.cos(dotAngle) * dotDist;
          const dotY = well.centerY + Math.sin(dotAngle) * dotDist;
          const dotSize = 1.5 + (i % 2) * 0.8;
          
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(45, 120, 150, 0.5)";
          ctx.fill();
        }
        
        const streakConfigs = [
          { angleOffset: 0.3, dist: 0.35, length: 25, curve: 4 },
          { angleOffset: 0.9, dist: 0.55, length: 18, curve: 3 },
          { angleOffset: 1.5, dist: 0.4, length: 30, curve: 5 },
          { angleOffset: 2.1, dist: 0.65, length: 12, curve: 2 },
          { angleOffset: 2.7, dist: 0.3, length: 22, curve: 4 },
          { angleOffset: 3.3, dist: 0.5, length: 35, curve: 6 },
          { angleOffset: 3.9, dist: 0.45, length: 15, curve: 3 },
          { angleOffset: 4.5, dist: 0.6, length: 28, curve: 5 },
          { angleOffset: 5.1, dist: 0.35, length: 20, curve: 4 },
          { angleOffset: 5.7, dist: 0.7, length: 16, curve: 3 },
          { angleOffset: 0.6, dist: 0.25, length: 10, curve: 2 },
          { angleOffset: 1.8, dist: 0.75, length: 8, curve: 2 },
        ];
        
        streakConfigs.forEach((config, i) => {
          const baseAngle = config.angleOffset + Math.sin(time * 0.00008 + i * 0.5) * 0.08;
          const streakDist = well.innerRadius * config.dist;
          const streakX = well.centerX + Math.cos(baseAngle) * streakDist;
          const streakY = well.centerY + Math.sin(baseAngle) * streakDist;
          const tangentAngle = baseAngle + Math.PI / 2;
          const streakLength = config.length;
          const streakAlpha = 0.3 + Math.sin(time * 0.002 + i * 1.5) * 0.12;
          const wobbleY = Math.sin(time * 0.0015 + i * 2.3) * 1.5;
          
          ctx.save();
          ctx.translate(streakX, streakY);
          ctx.rotate(tangentAngle + Math.sin(time * 0.0003 + i) * 0.08);
          ctx.translate(0, wobbleY);
          
          ctx.beginPath();
          ctx.moveTo(-streakLength, 0);
          ctx.quadraticCurveTo(-streakLength * 0.3, -config.curve, 0, 0);
          ctx.quadraticCurveTo(streakLength * 0.3, config.curve, streakLength, 0);
          ctx.quadraticCurveTo(streakLength * 0.3, config.curve + 1.5, 0, 1);
          ctx.quadraticCurveTo(-streakLength * 0.3, -config.curve + 1.5, -streakLength, 0);
          ctx.closePath();
          
          const streakGrad = ctx.createLinearGradient(-streakLength, 0, streakLength, 0);
          streakGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
          streakGrad.addColorStop(0.15, `rgba(200, 235, 250, ${streakAlpha * 0.5})`);
          streakGrad.addColorStop(0.5, `rgba(240, 255, 255, ${streakAlpha})`);
          streakGrad.addColorStop(0.85, `rgba(200, 235, 250, ${streakAlpha * 0.5})`);
          streakGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
          
          ctx.fillStyle = streakGrad;
          ctx.fill();
          ctx.restore();
        });
        
        drawWellRipple(well.centerX, well.centerY, 0, well.innerRadius * 0.85, 4, 0.25);
        drawWellRipple(well.centerX - well.innerRadius * 0.25, well.centerY - well.innerRadius * 0.15, 2000, well.innerRadius * 0.5, 3, 0.2);

        currentFishes.forEach((fish, index) => {
          ctx.save();
          ctx.translate(fish.x, fish.y);
          ctx.rotate(fish.smoothAngle);

          // Improved animation - smoother, more natural swimming
          const baseSpeed = fish.fishState === "idle" ? 0.004 : 
                           fish.fishState === "circling" ? 0.025 : 0.012;
          const tailWiggle = Math.sin(time * baseSpeed + index * 1.5) * 0.15;
          const bodyWave = Math.sin(time * baseSpeed * 0.7 + index) * 0.03;
          const breathe = 1 + Math.sin(time * 0.002 + index * 0.5) * 0.02;

          // Draw tail first (behind body)
          ctx.save();
          ctx.rotate(tailWiggle);
          ctx.beginPath();
          ctx.moveTo(-fish.type.size * 0.6, 0);
          ctx.quadraticCurveTo(-fish.type.size * 1.0, -fish.type.size * 0.15, -fish.type.size * 1.3, -fish.type.size * 0.35);
          ctx.quadraticCurveTo(-fish.type.size * 1.1, 0, -fish.type.size * 1.3, fish.type.size * 0.35);
          ctx.quadraticCurveTo(-fish.type.size * 1.0, fish.type.size * 0.15, -fish.type.size * 0.6, 0);
          ctx.closePath();
          ctx.fillStyle = fish.type.color;
          ctx.fill();
          ctx.restore();

          // Draw body on top
          ctx.save();
          ctx.rotate(bodyWave);
          ctx.beginPath();
          ctx.ellipse(0, 0, fish.type.size * breathe, fish.type.size * 0.45 * breathe, 0, 0, Math.PI * 2);
          ctx.fillStyle = fish.type.color;
          ctx.fill();
          ctx.restore();

          // Dorsal fin with very subtle animation
          const finWave = Math.sin(time * baseSpeed * 1.2 + index * 2) * 0.03;
          ctx.save();
          ctx.rotate(finWave);
          ctx.beginPath();
          ctx.moveTo(-fish.type.size * 0.1, -fish.type.size * 0.35);
          ctx.quadraticCurveTo(0, -fish.type.size * 0.6, fish.type.size * 0.12, -fish.type.size * 0.35);
          ctx.closePath();
          ctx.fillStyle = fish.type.color;
          ctx.fill();
          ctx.restore();

          if (fish.id === currentInterestedFishId && (fish.fishState === "nibbling" || fish.fishState === "biting" || fish.fishState === "circling")) {
            const pulseSize = fish.type.size + 10 + Math.sin(time * 0.01) * 5;
            ctx.strokeStyle = `rgba(100, 150, 200, ${0.3 + Math.sin(time * 0.01) * 0.1})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.restore();
        });

        ctx.restore();
        
        const wellSize = well.outerRadius * 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          wellImageRef.current,
          well.centerX - wellSize / 2,
          well.centerY - wellSize / 2,
          wellSize,
          wellSize
        );
      } else {
        currentFishes.forEach((fish, index) => {
          ctx.save();
          ctx.translate(fish.x, fish.y);
          ctx.rotate(fish.smoothAngle);

          // Improved animation - smoother, more natural swimming
          const baseSpeed = fish.fishState === "idle" ? 0.004 : 
                           fish.fishState === "circling" ? 0.025 : 0.012;
          const tailWiggle = Math.sin(time * baseSpeed + index * 1.5) * 0.15;
          const bodyWave = Math.sin(time * baseSpeed * 0.7 + index) * 0.03;
          const breathe = 1 + Math.sin(time * 0.002 + index * 0.5) * 0.02;

          // Draw tail first (behind body)
          ctx.save();
          ctx.rotate(tailWiggle);
          ctx.beginPath();
          ctx.moveTo(-fish.type.size * 0.6, 0);
          ctx.quadraticCurveTo(-fish.type.size * 1.0, -fish.type.size * 0.15, -fish.type.size * 1.3, -fish.type.size * 0.35);
          ctx.quadraticCurveTo(-fish.type.size * 1.1, 0, -fish.type.size * 1.3, fish.type.size * 0.35);
          ctx.quadraticCurveTo(-fish.type.size * 1.0, fish.type.size * 0.15, -fish.type.size * 0.6, 0);
          ctx.closePath();
          ctx.fillStyle = fish.type.color;
          ctx.fill();
          ctx.restore();

          // Draw body on top
          ctx.save();
          ctx.rotate(bodyWave);
          ctx.beginPath();
          ctx.ellipse(0, 0, fish.type.size * breathe, fish.type.size * 0.45 * breathe, 0, 0, Math.PI * 2);
          ctx.fillStyle = fish.type.color;
          ctx.fill();
          ctx.restore();

          // Dorsal fin with very subtle animation
          const finWave = Math.sin(time * baseSpeed * 1.2 + index * 2) * 0.03;
          ctx.save();
          ctx.rotate(finWave);
          ctx.beginPath();
          ctx.moveTo(-fish.type.size * 0.1, -fish.type.size * 0.35);
          ctx.quadraticCurveTo(0, -fish.type.size * 0.6, fish.type.size * 0.12, -fish.type.size * 0.35);
          ctx.closePath();
          ctx.fillStyle = fish.type.color;
          ctx.fill();
          ctx.restore();

          if (fish.id === currentInterestedFishId && (fish.fishState === "nibbling" || fish.fishState === "biting" || fish.fishState === "circling")) {
            const pulseSize = fish.type.size + 10 + Math.sin(time * 0.01) * 5;
            ctx.strokeStyle = `rgba(100, 150, 200, ${0.3 + Math.sin(time * 0.01) * 0.1})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.restore();
        });
      }

      const currentPhase = useFishing.getState().phase;
      const currentBobberDepth = useFishing.getState().bobberDepth;
      const currentCastProgress = useFishing.getState().castProgress;
      const currentBobberX = useFishing.getState().bobberX;
      const currentBobberY = useFishing.getState().bobberY;

      const drawBobberReflection = (x: number, y: number) => {
        const reflectionSize = 25 + Math.sin(time * 0.004) * 5;
        const reflectionAlpha = 0.35 + Math.sin(time * 0.005) * 0.1;
        
        const reflectionGrad = ctx.createRadialGradient(x, y, 0, x, y, reflectionSize);
        reflectionGrad.addColorStop(0, `rgba(255, 255, 255, ${reflectionAlpha})`);
        reflectionGrad.addColorStop(0.4, `rgba(200, 240, 255, ${reflectionAlpha * 0.6})`);
        reflectionGrad.addColorStop(0.7, `rgba(150, 220, 240, ${reflectionAlpha * 0.3})`);
        reflectionGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        
        ctx.beginPath();
        ctx.arc(x, y, reflectionSize, 0, Math.PI * 2);
        ctx.fillStyle = reflectionGrad;
        ctx.fill();
      };

      const drawBobber = (x: number, y: number, size: number, alpha: number = 1, inWater: boolean = false) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        
        if (inWater) {
          ctx.globalAlpha = 1;
          drawBobberReflection(x, y);
          ctx.globalAlpha = alpha;
        }
        
        if (bobberImageRef.current) {
          const imgSize = size * 2.5;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            bobberImageRef.current,
            x - imgSize / 2,
            y - imgSize / 2,
            imgSize,
            imgSize
          );
        }
        
        ctx.restore();
      };

      if (currentPhase === "idle" || currentPhase === "positioning") {
        const pulseAlpha = 0.4 + Math.sin(time * 0.005) * 0.1;
        drawBobber(bobberTargetX, bobberTargetY, 14, pulseAlpha);
      }

      if (currentPhase === "casting") {
        const startY = 0;
        const endX = currentBobberX;
        const endY = currentBobberY;
        
        const arcHeight = Math.min(150, dimensions.height * 0.3);
        const progress = currentCastProgress;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const currentX = bobberTargetX + (endX - bobberTargetX) * easeProgress;
        const currentY = startY + (endY - startY) * easeProgress - Math.sin(easeProgress * Math.PI) * arcHeight;
        
        drawBobber(currentX, currentY, 12);
      }

      if (currentPhase !== "idle" && currentPhase !== "positioning" && currentPhase !== "casting") {
        const bobberYOffset = currentBobberDepth * 8;
        const bobble = Math.sin(time * 0.005) * 2 * (1 - currentBobberDepth);
        const bobberY = currentBobberY + bobberYOffset + bobble;

        const rodX = dimensions.width * 0.1;
        const rodY = -10;
        
        const swayAmount = 15 + Math.sin(time * 0.002) * 8;
        const swayX = Math.sin(time * 0.003) * swayAmount;
        const swayY = Math.cos(time * 0.002) * swayAmount * 0.3;
        
        const tensionFactor = currentBobberDepth > 0.3 ? 0.7 : 1.0;
        const midX = (rodX + currentBobberX) / 2 + swayX * tensionFactor;
        const midY = (rodY + bobberY) / 2 + 40 + swayY * tensionFactor;
        
        const ctrl1X = rodX + (midX - rodX) * 0.5 + swayX * 0.3;
        const ctrl1Y = rodY + 60 + swayY * 0.5;
        const ctrl2X = midX + (currentBobberX - midX) * 0.5 - swayX * 0.2;
        const ctrl2Y = bobberY - 40 + swayY * 0.3;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(rodX, rodY);
        ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, currentBobberX, bobberY - 14);
        ctx.strokeStyle = "rgba(60, 60, 60, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(rodX + 0.5, rodY);
        ctx.bezierCurveTo(ctrl1X + 0.5, ctrl1Y, ctrl2X + 0.5, ctrl2Y, currentBobberX + 0.5, bobberY - 14);
        ctx.strokeStyle = "rgba(120, 120, 120, 0.3)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();

        const bobberSize = 14 - currentBobberDepth * 4;
        drawBobber(currentBobberX, bobberY, bobberSize, 1, true);

        if (currentBobberDepth > 0.5) {
          ctx.save();
          for (let i = 0; i < 3; i++) {
            const rippleProgress = ((time * 0.003 + i * 0.33) % 1);
            const rippleSize = 10 + rippleProgress * 40;
            const rippleAlpha = (1 - rippleProgress) * 0.3;
            ctx.beginPath();
            ctx.arc(currentBobberX, bobberY, rippleSize, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 150, 200, ${rippleAlpha})`;
            ctx.lineWidth = 2 - rippleProgress;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      splashParticlesRef.current = splashParticlesRef.current.filter((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.2;
        particle.life -= 0.03;

        if (particle.life > 0) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150, 180, 210, ${particle.life * 0.6})`;
          ctx.fill();
          return true;
        }
        return false;
      });

      bubbleParticlesRef.current = bubbleParticlesRef.current.filter((bubble) => {
        bubble.x += bubble.vx;
        bubble.y += bubble.vy;
        bubble.vx *= 0.98;
        bubble.life -= 0.02;

        if (bubble.life > 0) {
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.size * bubble.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 220, 240, ${bubble.life * 0.5})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${bubble.life * 0.6})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          return true;
        }
        return false;
      });

      updateFishes(deltaTime, now);
      handleGamePhaseUpdates();

      ctx.restore();
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, bobberTargetX, bobberTargetY, updateFishes, handleGamePhaseUpdates, bobberImageLoaded]);

  const isInsideWell = (x: number, y: number): boolean => {
    if (!wellBoundsRef.current) return true;
    
    const well = wellBoundsRef.current;
    const dx = x - well.centerX;
    const dy = y - well.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    return dist <= well.innerRadius;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const currentPhase = useFishing.getState().phase;
    if (currentPhase !== "idle" && currentPhase !== "positioning") return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!isInsideWell(x, y)) return;

    setIsDragging(true);
    dragStartRef.current = { x, y };
    setBobberTarget(x, y);
    setPhase("positioning");
    triggerHaptic("light");
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!isInsideWell(x, y)) return;

    setBobberTarget(x, y);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleCast = () => {
    const currentPhase = useFishing.getState().phase;
    if (currentPhase === "idle" || currentPhase === "positioning") {
      castLine();
      triggerHaptic("medium");
    }
  };

  const handleReel = () => {
    const currentPhase = useFishing.getState().phase;
    if (currentPhase === "waiting" || currentPhase === "nibbling" || currentPhase === "biting") {
      reelIn();
    }
  };

  const handleCloseCatchPopup = () => {
    setShowCatchPopup(false);
    resetGame();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: "#F5F7FA" }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width * (window.devicePixelRatio || 1)}
        height={dimensions.height * (window.devicePixelRatio || 1)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="touch-none cursor-crosshair"
        style={{ width: dimensions.width, height: dimensions.height }}
      />

      {/* Category buttons - centered row */}
      <div className="absolute left-0 right-0 z-10 flex justify-center" style={{ top: `calc(50% + 70px - 200px)` }}>
        <div className="flex gap-2 px-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 backdrop-blur-md rounded-full shadow-sm border border-white/50 active:scale-95 transition-transform">
            <Globe className="w-4 h-4 text-gray-600" />
            <span className="text-[11px] font-medium text-gray-700">Land</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 backdrop-blur-md rounded-full shadow-sm border border-white/50 active:scale-95 transition-transform">
            <MapPin className="w-4 h-4 text-gray-600" />
            <span className="text-[11px] font-medium text-gray-700">Stadt</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 backdrop-blur-md rounded-full shadow-sm border border-white/50 active:scale-95 transition-transform">
            <BarChart3 className="w-4 h-4 text-gray-600" />
            <span className="text-[11px] font-medium text-gray-700">Statistik</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 backdrop-blur-md rounded-full shadow-sm border border-white/50 active:scale-95 transition-transform">
            <FishIcon className="w-4 h-4 text-gray-600" />
            <span className="text-[11px] font-medium text-gray-700">Sammlung</span>
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 right-4">
        {(phase === "idle" || phase === "positioning") && (
          <button
            onClick={handleCast}
            className="w-24 h-24 rounded-full shadow-lg transition-all duration-150
                     hover:shadow-xl hover:scale-110 active:scale-90
                     focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            <img 
              src="/btn-cast.png" 
              alt="Angel auswerfen" 
              className="w-full h-full object-contain"
            />
          </button>
        )}

        {(phase === "waiting" || phase === "nibbling" || phase === "biting") && (
          <button
            onClick={handleReel}
            className={`w-24 h-24 rounded-full shadow-lg transition-all duration-150
                     hover:shadow-xl hover:scale-110 active:scale-90
                     focus:outline-none focus:ring-2 focus:ring-blue-400/50
                     ${phase === "biting" ? "animate-pulse" : ""}`}
          >
            <img 
              src="/btn-reel.png" 
              alt="Angel einholen" 
              className="w-full h-full object-contain"
            />
          </button>
        )}
      </div>

      {showHint && phase === "idle" && (
        <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: `calc(50% + 70px - 20px)` }}>
          <div className="px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full
                        text-white/90 font-medium text-[11px]">
            Tippe, um die Angel zu positionieren
          </div>
        </div>
      )}

      {missedWellMessage && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="px-6 py-3 bg-red-500/90 backdrop-blur-xl rounded-2xl shadow-lg
                        text-white font-medium text-sm border border-red-400/50">
            Du hast den Brunnen nicht getroffen!
          </div>
        </div>
      )}

      {showCatchPopup && <CatchPopup onClose={handleCloseCatchPopup} />}
    </div>
  );
}
