import React, { useEffect, useRef } from "react";
import { createBugSimulation } from "../game/bugSimulation.js";
import { loadSpriteSheet } from "../game/spriteLoader.js";

const BUG_DRAW_WIDTH = 150;
const BUG_DRAW_HEIGHT = 151;

export function GameCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const simulation = createBugSimulation();

    let isMounted = true;
    let animationFrameId = 0;
    let lastTime = performance.now();
    let spriteSheet = null;
    let viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      viewport = { width, height };

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      simulation.resize(width, height);
    };

    const draw = () => {
      context.fillStyle = "#2f2f33";
      context.fillRect(0, 0, viewport.width, viewport.height);

      if (!spriteSheet) {
        return;
      }

      const bug = simulation.getState();
      const frame = spriteSheet.frames[bug.frameIndex];

      context.save();
      context.translate(bug.position.x, bug.position.y);
      context.rotate(bug.rotation);
      context.drawImage(
        spriteSheet.image,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        -BUG_DRAW_WIDTH / 2,
        -BUG_DRAW_HEIGHT / 2,
        BUG_DRAW_WIDTH,
        BUG_DRAW_HEIGHT,
      );
      context.restore();
    };

    const tick = (now) => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      simulation.update(deltaSeconds);
      draw();
      animationFrameId = window.requestAnimationFrame(tick);
    };

    resizeCanvas();

    loadSpriteSheet("./walking.json")
      .then((loadedSpriteSheet) => {
        if (!isMounted) {
          return;
        }

        spriteSheet = loadedSpriteSheet;
        draw();
        animationFrameId = window.requestAnimationFrame(tick);
      })
      .catch((error) => {
        console.error("Failed to load bug sprite", error);
      });

    window.addEventListener("resize", resizeCanvas);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", resizeCanvas);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return React.createElement("canvas", {
    ref: canvasRef,
    className: "game-canvas",
    "aria-label": "Bug playground",
  });
}
