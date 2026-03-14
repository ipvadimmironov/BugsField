(function () {
  const BUG_DRAW_WIDTH = 150;
  const BUG_DRAW_HEIGHT = 151;
  const BUG_HITBOX_WIDTH = 150;
  const BUG_HITBOX_HEIGHT = 151;
  const BACKGROUND_IMAGE_SRC = "background.png";
  const MAGNIFIER_IMAGE_SRC = "magnifier.png";
  const MAGNIFIER_HOTSPOT_X = 285;
  const MAGNIFIER_HOTSPOT_Y = 268;
  const MAGNIFIER_RADIUS = 240;
  const MAGNIFIER_ZOOM = 1.9;
  const SHOW_COLLISION_DEBUG = false;
  const HITBOX_OVERLAP_ALLOWANCE = 38;
  const TWO_PI = Math.PI * 2;
  const WALK_FRAMES = [1, 2, 3, 4, 5, 6];
  const WALK_FRAME_DURATION = 0.1;
  const MOVE_SPEED = 110;
  const TURN_SPEED = 1.9;
  const BLOCKED_TURN_SPEED = 4.8;
  const EDGE_PADDING = 90;
  const AVOID_RADIUS = 160;
  const RANDOM_TURN_MIN_INTERVAL = 1.5;
  const RANDOM_TURN_MAX_INTERVAL = 4.5;
  const BLOCKED_TURN_MIN_INTERVAL = 0.05;
  const BLOCKED_TURN_MAX_INTERVAL = 0.18;
  const BUG_COUNT = 10;
  const BUG_ZOOMS = [0.5, 0.6, 0.7, 0.8];//[1, 1.1, 0.9, 1.2];
  const SPAWN_ATTEMPTS = 100;
  const SPRITE_FRAMES = [
    { x: 0, y: 0, w: 270, h: 272 },
    { x: 270, y: 0, w: 270, h: 272 },
    { x: 540, y: 0, w: 270, h: 272 },
    { x: 810, y: 0, w: 270, h: 272 },
    { x: 1080, y: 0, w: 270, h: 272 },
    { x: 1350, y: 0, w: 270, h: 272 },
    { x: 1620, y: 0, w: 270, h: 272 },
    { x: 1890, y: 0, w: 270, h: 272 },
    { x: 2160, y: 0, w: 270, h: 272 },
    { x: 2430, y: 0, w: 270, h: 272 },
  ];

  const app = document.getElementById("app");
  if (!app) {
    throw new Error("Missing #app root element.");
  }

  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.setAttribute("aria-label", "Bug playground");
  canvas.style.cursor = "none";
  app.replaceChildren(canvas);

  const context = canvas.getContext("2d");
  const sceneCanvas = document.createElement("canvas");
  const sceneContext = sceneCanvas.getContext("2d");
  const simulation = createBugSimulation();
  let animationFrameId = 0;
  let lastTime = performance.now();
  let backgroundImage = null;
  let spriteImage = null;
  let magnifierImage = null;
  let pointerPosition = null;
  let isPointerInsideCanvas = false;
  let devicePixelRatio = window.devicePixelRatio || 1;
  let viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    devicePixelRatio = dpr;
    const width = window.innerWidth;
    const height = window.innerHeight;
    viewport = { width, height };

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    sceneCanvas.width = canvas.width;
    sceneCanvas.height = canvas.height;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    sceneContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    simulation.resize(width, height);
  }

  function drawScene(targetContext) {
    if (!backgroundImage || !spriteImage) {
      targetContext.fillStyle = "#2f2f33";
      targetContext.fillRect(0, 0, viewport.width, viewport.height);
      return;
    }

    targetContext.drawImage(
      backgroundImage,
      0,
      0,
    );

    const bugs = simulation.getState();

    bugs.forEach((bug) => {
      const frame = SPRITE_FRAMES[bug.frameIndex];
      const drawWidth = BUG_DRAW_WIDTH * bug.zoom;
      const drawHeight = BUG_DRAW_HEIGHT * bug.zoom;

      targetContext.save();
      targetContext.translate(bug.position.x, bug.position.y);
      targetContext.rotate(bug.rotation);
      targetContext.drawImage(
        spriteImage,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight,
      );
      targetContext.restore();
    });

    if (SHOW_COLLISION_DEBUG) {
      bugs.forEach((bug, index) => {
        drawDebugRect(targetContext, bug.debug && bug.debug.currentRect, "#00ff88", "rgba(0, 255, 136, 0.16)");
        drawDebugRect(
          targetContext,
          bug.debug && bug.debug.nextRect,
          bug.debug && bug.debug.canMove ? "#00b7ff" : "#ff4d4d",
          bug.debug && bug.debug.canMove
            ? "rgba(0, 183, 255, 0.16)"
            : "rgba(255, 77, 77, 0.2)",
        );
        drawDebugLabel(targetContext, bug, index);
      });
      drawDebugHud(targetContext, bugs);
    }
  }

  function draw() {
    drawScene(sceneContext);
    context.clearRect(0, 0, viewport.width, viewport.height);
    context.drawImage(
      sceneCanvas,
      0,
      0,
      sceneCanvas.width,
      sceneCanvas.height,
      0,
      0,
      viewport.width,
      viewport.height,
    );

    if (!backgroundImage || !spriteImage) {
      return;
    }

    if (isPointerInsideCanvas && pointerPosition) {
      drawMagnifierView(context, sceneCanvas, pointerPosition.x, pointerPosition.y);
    }

    if (magnifierImage && isPointerInsideCanvas && pointerPosition) {
      context.drawImage(
        magnifierImage,
        pointerPosition.x - MAGNIFIER_HOTSPOT_X,
        pointerPosition.y - MAGNIFIER_HOTSPOT_Y,
      );
    }
  }

  function tick(now) {
    const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    simulation.update(deltaSeconds);
    draw();
    animationFrameId = window.requestAnimationFrame(tick);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", function () {
    window.cancelAnimationFrame(animationFrameId);
  });
  canvas.addEventListener("mouseenter", function () {
    isPointerInsideCanvas = true;
  });
  canvas.addEventListener("mousemove", function (event) {
    const rect = canvas.getBoundingClientRect();
    isPointerInsideCanvas = true;
    pointerPosition = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  });
  canvas.addEventListener("mouseleave", function () {
    isPointerInsideCanvas = false;
    pointerPosition = null;
  });

  Promise.all([
    loadImage(BACKGROUND_IMAGE_SRC),
    loadImage("./walkingsprite.png"),
    loadImage(MAGNIFIER_IMAGE_SRC),
  ])
    .then(function ([loadedBackgroundImage, loadedSpriteImage, loadedMagnifierImage]) {
      backgroundImage = loadedBackgroundImage;
      spriteImage = loadedSpriteImage;
      magnifierImage = loadedMagnifierImage;
      draw();
      animationFrameId = window.requestAnimationFrame(tick);
    })
    .catch(function (error) {
      console.error("Failed to load bug sprite", error);
    });

  function createBugSimulation() {
    const state = {
      bounds: { width: window.innerWidth, height: window.innerHeight },
      bugs: createInitialBugs(window.innerWidth, window.innerHeight),
      debug: [],
    };

    return {
      resize(width, height) {
        state.bounds.width = width;
        state.bounds.height = height;
        state.bugs.forEach((bug) => {
          clampBugToBounds(bug, state.bounds);
        });
        separateOverlappingBugs(state.bugs, state.bounds);
        state.debug = state.bugs.map((bug) =>
          createDebugEntry({
            currentRect: getBugRect(bug.position, bug.zoom),
            nextRect: getBugRect(bug.position, bug.zoom),
            nextPosition: bug.position,
            decision: {
              canMove: true,
              blockedByBounds: false,
              blockedByCurrent: false,
              blockedByNext: false,
            },
          }),
        );
      },

      update(deltaSeconds) {
        const snapshot = state.bugs.map(createSnapshot);
        const intents = snapshot.map((bug, index) =>
          createNextIntent(
            bug,
            state.bounds,
            snapshot.filter((_, otherIndex) => otherIndex !== index),
            deltaSeconds,
          ),
        );
        const decisions = intents.map((intent, index) =>
          getMoveDecision(index, intent.nextRect, snapshot, intents, state.bounds),
        );
        state.debug = intents.map((intent, index) =>
          createDebugEntry({
            currentRect: snapshot[index].rect,
            nextRect: intent.nextRect,
            nextPosition: intent.position,
            decision: decisions[index],
          }),
        );

        state.bugs.forEach((bug, index) => {
          const intent = intents[index];
          const decision = decisions[index];
          bug.rotation = intent.rotation;
          bug.targetRotation = intent.targetRotation;
          bug.turnCooldown = intent.turnCooldown;

          if (decision.canMove) {
            bug.position = intent.position;
            bug.blockedFrames = 0;
            bug.blockedTurnDirection = 0;
            advanceWalkFrame(bug, deltaSeconds);
          } else {
            bug.blockedFrames += 1;

            if (decision.blockedByCurrent || decision.blockedByNext) {
              if (bug.blockedTurnDirection === 0) {
                bug.blockedTurnDirection = pickBlockedTurnDirection();
              }

              bug.targetRotation = normalizeAngle(
                bug.rotation + bug.blockedTurnDirection * Math.PI,
              );
              bug.turnCooldown = randomRange(
                BLOCKED_TURN_MIN_INTERVAL,
                BLOCKED_TURN_MAX_INTERVAL,
              );
            }
          }
        });
      },

      getState() {
        return state.bugs.map((bug, index) => ({
          position: { ...bug.position },
          rotation: bug.rotation,
          frameIndex: bug.frameIndex,
          zoom: bug.zoom,
          hue: bug.hue,
          debug: state.debug[index] || null,
        }));
      },
    };
  }

  function createInitialBugs(width, height) {
    const bugs = [];

    for (let index = 0; index < BUG_COUNT; index += 1) {
      bugs.push(createBugState(width, height, bugs));
    }

    return bugs;
  }

  function createBugState(width, height, existingBugs) {
    let fallbackBug = createRandomBugState(width, height);
    clampBugToBounds(fallbackBug, { width, height });

    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
      const candidate = createRandomBugState(width, height);
      clampBugToBounds(candidate, { width, height });

      if (
        !rectIntersectsAny(
          getBugRect(candidate.position, candidate.zoom),
          existingBugs.map((bug) => getBugRect(bug.position, bug.zoom)),
        )
      ) {
        return candidate;
      }

      fallbackBug = candidate;
    }

    return fallbackBug;
  }

  function createRandomBugState(width, height) {
    const rotation = randomRange(0, TWO_PI);

    return {
      position: {
        x: randomRange(0, width),
        y: randomRange(0, height),
      },
      rotation,
      targetRotation: rotation,
      frameIndex: WALK_FRAMES[Math.floor(randomRange(0, WALK_FRAMES.length))],
      frameTimer: randomRange(0, WALK_FRAME_DURATION),
      turnCooldown: randomRange(RANDOM_TURN_MIN_INTERVAL, RANDOM_TURN_MAX_INTERVAL),
      blockedFrames: 0,
      blockedTurnDirection: 0,
      zoom: BUG_ZOOMS[Math.floor(Math.random() * BUG_ZOOMS.length)],
      hue: Math.round(randomRange(0, 360)),
    };
  }

  function createSnapshot(bug) {
    return {
      position: { ...bug.position },
      rotation: bug.rotation,
      targetRotation: bug.targetRotation,
      turnCooldown: bug.turnCooldown,
      blockedFrames: bug.blockedFrames,
      blockedTurnDirection: bug.blockedTurnDirection,
      zoom: bug.zoom,
      rect: getBugRect(bug.position, bug.zoom),
    };
  }

  function createDebugEntry({ currentRect, nextRect, nextPosition, decision }) {
    return {
      currentRect,
      nextRect,
      nextPosition: { ...nextPosition },
      canMove: decision.canMove,
      blockedByBounds: decision.blockedByBounds,
      blockedByCurrent: decision.blockedByCurrent,
      blockedByNext: decision.blockedByNext,
    };
  }

  function createNextIntent(bug, bounds, otherBugs, deltaSeconds) {
    let turnCooldown = bug.turnCooldown - deltaSeconds;
    let targetRotation = bug.targetRotation;

    if (bug.blockedTurnDirection !== 0) {
      targetRotation = normalizeAngle(
        bug.rotation + bug.blockedTurnDirection * (Math.PI / 2),
      );
      turnCooldown = randomRange(
        BLOCKED_TURN_MIN_INTERVAL,
        BLOCKED_TURN_MAX_INTERVAL,
      );
    } else if (turnCooldown <= 0) {
      targetRotation = normalizeAngle(
        bug.rotation + randomRange(-Math.PI / 2, Math.PI / 2),
      );
      turnCooldown = randomRange(
        RANDOM_TURN_MIN_INTERVAL,
        RANDOM_TURN_MAX_INTERVAL,
      );
    }

    targetRotation = steerAwayFromEdges(bug, bounds, targetRotation);
    if (bug.blockedTurnDirection === 0) {
      targetRotation = steerAwayFromBugs(bug, otherBugs, targetRotation);
    }

    const turnSpeed =
      bug.blockedFrames > 0 ? BLOCKED_TURN_SPEED : TURN_SPEED;
    const rotation = rotateTowards(
      bug.rotation,
      targetRotation,
      turnSpeed * deltaSeconds,
    );
    const direction = {
      x: Math.sin(rotation),
      y: -Math.cos(rotation),
    };
    const position = {
      x: bug.position.x + direction.x * MOVE_SPEED * deltaSeconds,
      y: bug.position.y + direction.y * MOVE_SPEED * deltaSeconds,
    };
    clampPositionToBounds(position, bug.zoom, bounds);

    return {
      rotation,
      targetRotation,
      turnCooldown,
      position,
      nextRect: getBugRect(position, bug.zoom),
    };
  }

  function getMoveDecision(index, nextRect, snapshot, intents, bounds) {
    const blockedByBounds = !isRectInsideBounds(nextRect, bounds);
    const otherCurrentRects = snapshot
      .filter((_, otherIndex) => otherIndex !== index)
      .map((bug) => bug.rect);
    const blockedByCurrent = rectIntersectsAny(nextRect, otherCurrentRects);

    const otherNextRects = intents
      .filter((_, otherIndex) => otherIndex !== index)
      .map((intent) => intent.nextRect);
    const blockedByNext = rectIntersectsAny(nextRect, otherNextRects);

    return {
      canMove: !(blockedByBounds || blockedByCurrent || blockedByNext),
      blockedByBounds,
      blockedByCurrent,
      blockedByNext,
    };
  }

  function steerAwayFromEdges(bug, bounds, fallbackRotation) {
    const rect = getBugRect(bug.position, bug.zoom);
    const nearLeft = rect.left < EDGE_PADDING;
    const nearRight = rect.right > bounds.width - EDGE_PADDING;
    const nearTop = rect.top < EDGE_PADDING;
    const nearBottom = rect.bottom > bounds.height - EDGE_PADDING;

    if (!(nearLeft || nearRight || nearTop || nearBottom)) {
      return fallbackRotation;
    }

    return normalizeAngle(
      Math.atan2(bounds.width / 2 - bug.position.x, -(bounds.height / 2 - bug.position.y)),
    );
  }

  function steerAwayFromBugs(bug, otherBugs, fallbackRotation) {
    let sumDx = 0;
    let sumDy = 0;

    for (const other of otherBugs) {
      const dx = bug.position.x - other.position.x;
      const dy = bug.position.y - other.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist < AVOID_RADIUS && dist > 1) {
        const weight = 1 - dist / AVOID_RADIUS;
        sumDx += (dx / dist) * weight;
        sumDy += (dy / dist) * weight;
      }
    }

    if (sumDx === 0 && sumDy === 0) {
      return fallbackRotation;
    }

    return normalizeAngle(Math.atan2(sumDx, -sumDy));
  }

  function advanceWalkFrame(bug, deltaSeconds) {
    bug.frameTimer += deltaSeconds;
    while (bug.frameTimer >= WALK_FRAME_DURATION) {
      bug.frameTimer -= WALK_FRAME_DURATION;
      const currentIndex = WALK_FRAMES.indexOf(bug.frameIndex);
      bug.frameIndex = WALK_FRAMES[(currentIndex + 1) % WALK_FRAMES.length];
    }
  }

  function clampBugToBounds(bug, bounds) {
    clampPositionToBounds(bug.position, bug.zoom, bounds);
  }

  function separateOverlappingBugs(bugs, bounds) {
    for (let pass = 0; pass < SPAWN_ATTEMPTS; pass += 1) {
      let hasOverlap = false;

      for (let index = 0; index < bugs.length; index += 1) {
        const bug = bugs[index];
        const bugRect = getBugRect(bug.position, bug.zoom);

        for (let otherIndex = index + 1; otherIndex < bugs.length; otherIndex += 1) {
          const otherBug = bugs[otherIndex];
          const otherRect = getBugRect(otherBug.position, otherBug.zoom);

          if (!rectsIntersect(bugRect, otherRect)) {
            continue;
          }

          hasOverlap = true;
          const dx = bug.position.x - otherBug.position.x;
          const dy = bug.position.y - otherBug.position.y;
          const moveHorizontally = Math.abs(dx) >= Math.abs(dy);

          if (moveHorizontally) {
            const overlap =
              Math.min(bugRect.right, otherRect.right) -
              Math.max(bugRect.left, otherRect.left);
          const shift = Math.max(0, overlap - HITBOX_OVERLAP_ALLOWANCE) / 2 + 1;
            const direction = dx >= 0 ? 1 : -1;
            bug.position.x += shift * direction;
            otherBug.position.x -= shift * direction;
          } else {
            const overlap =
              Math.min(bugRect.bottom, otherRect.bottom) -
              Math.max(bugRect.top, otherRect.top);
          const shift = Math.max(0, overlap - HITBOX_OVERLAP_ALLOWANCE) / 2 + 1;
            const direction = dy >= 0 ? 1 : -1;
            bug.position.y += shift * direction;
            otherBug.position.y -= shift * direction;
          }

          clampBugToBounds(bug, bounds);
          clampBugToBounds(otherBug, bounds);
        }
      }

      if (!hasOverlap) {
        return;
      }
    }
  }

  function clampPositionToBounds(position, zoom, bounds) {
    const halfWidth = (BUG_HITBOX_WIDTH * zoom) / 2;
    const halfHeight = (BUG_HITBOX_HEIGHT * zoom) / 2;

    position.x = clamp(
      position.x,
      Math.min(halfWidth, bounds.width / 2),
      Math.max(bounds.width / 2, bounds.width - halfWidth),
    );
    position.y = clamp(
      position.y,
      Math.min(halfHeight, bounds.height / 2),
      Math.max(bounds.height / 2, bounds.height - halfHeight),
    );
  }

  function getBugRect(position, zoom) {
    const width = BUG_HITBOX_WIDTH * zoom;
    const height = BUG_HITBOX_HEIGHT * zoom;

    return {
      left: position.x - width / 2,
      right: position.x + width / 2,
      top: position.y - height / 2,
      bottom: position.y + height / 2,
    };
  }

  function isRectInsideBounds(rect, bounds) {
    return (
      rect.left >= 0 &&
      rect.right <= bounds.width &&
      rect.top >= 0 &&
      rect.bottom <= bounds.height
    );
  }

  function rectIntersectsAny(rect, otherRects) {
    return otherRects.some((otherRect) => rectsIntersect(rect, otherRect));
  }

  function rectsIntersect(firstRect, secondRect) {
    const overlapX =
      Math.min(firstRect.right, secondRect.right) -
      Math.max(firstRect.left, secondRect.left);
    const overlapY =
      Math.min(firstRect.bottom, secondRect.bottom) -
      Math.max(firstRect.top, secondRect.top);

    return (
      overlapX > HITBOX_OVERLAP_ALLOWANCE &&
      overlapY > HITBOX_OVERLAP_ALLOWANCE
    );
  }

  function rotateTowards(current, target, maxStep) {
    const delta = shortestAngleDelta(current, target);
    if (Math.abs(delta) <= maxStep) {
      return normalizeAngle(target);
    }

    return normalizeAngle(current + Math.sign(delta) * maxStep);
  }

  function pickBlockedTurnDirection() {
    return Math.random() < 0.5 ? -1 : 1;
  }

  function shortestAngleDelta(from, to) {
    return normalizeAngle(to - from + Math.PI) - Math.PI;
  }

  function normalizeAngle(angle) {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function drawMagnifierView(targetContext, sourceCanvas, centerX, centerY) {
    const sourceRadius = (MAGNIFIER_RADIUS / MAGNIFIER_ZOOM) * devicePixelRatio;
    const sourceCenterX = centerX * devicePixelRatio;
    const sourceCenterY = centerY * devicePixelRatio;
    const sourceDiameter = sourceRadius * 2;
    const sourceX = clamp(
      sourceCenterX - sourceRadius,
      0,
      Math.max(0, sourceCanvas.width - sourceDiameter),
    );
    const sourceY = clamp(
      sourceCenterY - sourceRadius,
      0,
      Math.max(0, sourceCanvas.height - sourceDiameter),
    );

    targetContext.save();
    targetContext.beginPath();
    targetContext.arc(centerX, centerY, MAGNIFIER_RADIUS, 0, TWO_PI);
    targetContext.clip();
    targetContext.drawImage(
      sourceCanvas,
      sourceX,
      sourceY,
      sourceDiameter,
      sourceDiameter,
      centerX - MAGNIFIER_RADIUS,
      centerY - MAGNIFIER_RADIUS,
      MAGNIFIER_RADIUS * 2,
      MAGNIFIER_RADIUS * 2,
    );
    targetContext.restore();
  }

  function drawDebugRect(ctx, rect, color, fillColor) {
    if (!rect) {
      return;
    }

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.fillRect(
      rect.left,
      rect.top,
      rect.right - rect.left,
      rect.bottom - rect.top,
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      rect.left,
      rect.top,
      rect.right - rect.left,
      rect.bottom - rect.top,
    );
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDebugLabel(ctx, bug, index) {
    if (!bug.debug) {
      return;
    }

    const blockedReasons = [
      bug.debug.blockedByBounds ? "bounds" : null,
      bug.debug.blockedByCurrent ? "current" : null,
      bug.debug.blockedByNext ? "next" : null,
    ]
      .filter(Boolean)
      .join(",");

    ctx.save();
    ctx.fillStyle = bug.debug.canMove ? "#00ff88" : "#ff4d4d";
    ctx.font = "12px monospace";
    ctx.fillText(
      `${index} ${bug.debug.canMove ? "move" : `stop:${blockedReasons || "?"}`}`,
      bug.position.x + 12,
      bug.position.y - 12,
    );
    ctx.restore();
  }

  function drawDebugHud(ctx, bugs) {
    const withDebug = bugs.filter((bug) => bug.debug).length;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(12, 12, 260, 24);
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px monospace";
    ctx.fillText(
      `collision debug: on | bugs: ${bugs.length} | debug: ${withDebug}`,
      18,
      28,
    );
    ctx.restore();
  }
})();
