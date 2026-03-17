(function () {
  const BUG_DRAW_WIDTH = 150;
  const BUG_DRAW_HEIGHT = 151;
  const BUG_HITBOX_WIDTH = 150;
  const BUG_HITBOX_HEIGHT = 151;
  const BACKGROUND_IMAGE_SRC = "background.png";
  const MAGNIFIER_IMAGE_SRC = "magnifier.png";
  const HEALTH_100_IMAGE_SRC = "health100.png";
  const HEALTH_80_IMAGE_SRC = "health80.png";
  const HEALTH_40_IMAGE_SRC = "health40.png";
  const HEALTH_0_IMAGE_SRC = "health0.png";
  const MAGNIFIER_SCALE = 0.5;
  const MAGNIFIER_HOTSPOT_X = 142.5;
  const MAGNIFIER_HOTSPOT_Y = 134;
  const MAGNIFIER_RADIUS = 120;
  const MAGNIFIER_ZOOM = 1.9;
  const BUG_MAX_HEALTH = 100;
  const MAGNIFIER_DAMAGE_PER_SECOND = 35;
  const DEATH_ANIMATION_DURATION = 0.5;
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
  const STUCK_SPIN_UNLOCK_SECONDS = 2;
  const BUG_COUNT = 10;
  const BUG_ZOOMS = [0.3, 0.4, 0.5, 0.6];//[1, 1.1, 0.9, 1.2];
  const SPAWN_ATTEMPTS = 100;
  const SPRITE_FRAMES = Array.from({ length: 13 }, (_, index) => ({
    x: index * 270,
    y: 0,
    w: 270,
    h: 272,
  }));
  const DEATH_FRAMES = [7, 8, 9, 10, 11, 12];

  const app = document.getElementById("app");
  if (!app) {
    throw new Error("Missing #app root element.");
  }

  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.setAttribute("aria-label", "Bug playground");
  canvas.style.cursor = "none";
  canvas.style.touchAction = "auto";
  app.style.position = "relative";
  app.replaceChildren(canvas);

  const mobileModeToggle = document.createElement("button");
  mobileModeToggle.type = "button";
  mobileModeToggle.setAttribute("aria-pressed", "false");
  mobileModeToggle.style.position = "fixed";
  mobileModeToggle.style.top = "16px";
  mobileModeToggle.style.right = "16px";
  mobileModeToggle.style.zIndex = "10";
  mobileModeToggle.style.padding = "10px 14px";
  mobileModeToggle.style.border = "1px solid rgba(255, 255, 255, 0.28)";
  mobileModeToggle.style.borderRadius = "999px";
  mobileModeToggle.style.background = "rgba(10, 10, 14, 0.72)";
  mobileModeToggle.style.color = "#ffffff";
  mobileModeToggle.style.font = "600 14px system-ui, sans-serif";
  mobileModeToggle.style.backdropFilter = "blur(10px)";
  mobileModeToggle.style.webkitBackdropFilter = "blur(10px)";
  mobileModeToggle.style.cursor = "pointer";
  app.appendChild(mobileModeToggle);

  const context = canvas.getContext("2d");
  const sceneCanvas = document.createElement("canvas");
  const sceneContext = sceneCanvas.getContext("2d");
  const simulation = createBugSimulation();
  let animationFrameId = 0;
  let lastTime = performance.now();
  let backgroundImage = null;
  let bugSpriteImages = null;
  let magnifierImage = null;
  let pointerPosition = null;
  let isPointerInsideCanvas = false;
  let isMobileMode = false;
  let mobileDragPointerId = null;
  let mobileDragClientPosition = null;
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
    if (pointerPosition) {
      pointerPosition = clampPointerPosition(pointerPosition);
    } else if (isMobileMode) {
      pointerPosition = getDefaultMagnifierPosition();
    }
    simulation.resize(width, height);
  }

  function drawScene(targetContext) {
    if (!backgroundImage || !bugSpriteImages) {
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
      const frame = SPRITE_FRAMES[bug.renderFrameIndex];
      const bugSpriteImage = bugSpriteImages[bug.spriteKey];
      const drawWidth = BUG_DRAW_WIDTH * bug.zoom;
      const drawHeight = BUG_DRAW_HEIGHT * bug.zoom;

      targetContext.save();
      targetContext.translate(bug.position.x, bug.position.y);
      targetContext.rotate(bug.rotation);
      targetContext.drawImage(
        bugSpriteImage,
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

    bugs.forEach((bug) => {
      if (!bug.isDying) {
        drawBugHealth(targetContext, bug);
      }
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

    if (!backgroundImage || !bugSpriteImages) {
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
        magnifierImage.width * MAGNIFIER_SCALE,
        magnifierImage.height * MAGNIFIER_SCALE,
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
  canvas.addEventListener("pointerenter", function (event) {
    if (event.pointerType === "touch") {
      return;
    }
    isPointerInsideCanvas = true;
  });
  canvas.addEventListener("pointerdown", function (event) {
    if (isMobileMode) {
      startMobileDrag(event);
      isPointerInsideCanvas = true;
    } else {
      updatePointerPositionFromClient(event.clientX, event.clientY);
      isPointerInsideCanvas = true;
    }

    if (event.pointerType === "touch") {
      event.preventDefault();
    }
  });
  canvas.addEventListener("pointermove", function (event) {
    if (isMobileMode) {
      updateMobileDrag(event);
      isPointerInsideCanvas = true;
    } else {
      updatePointerPositionFromClient(event.clientX, event.clientY);
      isPointerInsideCanvas = true;
    }

    if (event.pointerType === "touch") {
      event.preventDefault();
    }
  });
  canvas.addEventListener("pointerleave", function (event) {
    if (isMobileMode || event.pointerType === "touch") {
      return;
    }
    isPointerInsideCanvas = false;
    pointerPosition = null;
  });
  canvas.addEventListener("pointerup", function (event) {
    stopMobileDrag(event);

    if (!isMobileMode && event.pointerType === "touch") {
      isPointerInsideCanvas = false;
      pointerPosition = null;
    }
  });
  canvas.addEventListener("pointercancel", function (event) {
    stopMobileDrag(event);

    if (!isMobileMode) {
      isPointerInsideCanvas = false;
      pointerPosition = null;
    }
  });
  mobileModeToggle.addEventListener("click", function () {
    setMobileMode(!isMobileMode);
  });
  updateMobileModeUi();

  Promise.all([
    loadImage(BACKGROUND_IMAGE_SRC),
    loadImage(HEALTH_100_IMAGE_SRC),
    loadImage(HEALTH_80_IMAGE_SRC),
    loadImage(HEALTH_40_IMAGE_SRC),
    loadImage(HEALTH_0_IMAGE_SRC),
    loadImage(MAGNIFIER_IMAGE_SRC),
  ])
    .then(function ([
      loadedBackgroundImage,
      loadedHealth100Image,
      loadedHealth80Image,
      loadedHealth40Image,
      loadedHealth0Image,
      loadedMagnifierImage,
    ]) {
      backgroundImage = loadedBackgroundImage;
      bugSpriteImages = {
        health100: loadedHealth100Image,
        health80: loadedHealth80Image,
        health40: loadedHealth40Image,
        health0: loadedHealth0Image,
      };
      magnifierImage = loadedMagnifierImage;
      draw();
      animationFrameId = window.requestAnimationFrame(tick);
    })
    .catch(function (error) {
      console.error("Failed to load game assets", error);
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
        damageBugsUnderMagnifier(state.bugs, deltaSeconds);
        state.bugs.forEach((bug) => {
          if (!bug.isDying && bug.health <= 0) {
            startBugDeath(bug);
          }
        });
        state.bugs.forEach((bug) => {
          if (bug.isDying) {
            updateBugDeath(bug, deltaSeconds);
          }
        });
        state.bugs = state.bugs.filter((bug) => !bug.isDead);

        if (state.bugs.length === 0) {
          state.debug = [];
          return;
        }

        const activeBugEntries = state.bugs
          .map((bug, index) => ({ bug, index }))
          .filter(({ bug }) => !bug.isDying);
        const activeBugs = activeBugEntries.map(({ bug }) => bug);

        if (activeBugs.length === 0) {
          state.debug = state.bugs.map(() => null);
          return;
        }

        const snapshot = activeBugs.map(createSnapshot);
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
        state.debug = state.bugs.map(() => null);
        activeBugEntries.forEach(({ index }, activeIndex) => {
          state.debug[index] = createDebugEntry({
            currentRect: snapshot[activeIndex].rect,
            nextRect: intents[activeIndex].nextRect,
            nextPosition: intents[activeIndex].position,
            decision: decisions[activeIndex],
          });
        });

        activeBugs.forEach((bug, index) => {
          const intent = intents[index];
          const decision = decisions[index];
          bug.rotation = intent.rotation;
          bug.targetRotation = intent.targetRotation;
          bug.turnCooldown = intent.turnCooldown;

          if (decision.canMove) {
            bug.position = intent.position;
            bug.blockedFrames = 0;
            bug.stationaryTime = 0;
            bug.blockedTurnDirection = 0;
            advanceWalkFrame(bug, deltaSeconds);
          } else {
            bug.blockedFrames += 1;
            bug.stationaryTime += deltaSeconds;

            if (
              decision.blockedByCurrent ||
              decision.blockedByNext ||
              bug.stationaryTime >= STUCK_SPIN_UNLOCK_SECONDS
            ) {
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
          renderFrameIndex: bug.isDying ? bug.deathFrameIndex : bug.frameIndex,
          spriteKey: bug.spriteKey,
          zoom: bug.zoom,
          hue: bug.hue,
          health: bug.health,
          isDying: bug.isDying,
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
      stationaryTime: 0,
      blockedTurnDirection: 0,
      health: BUG_MAX_HEALTH,
      spriteKey: "health100",
      isDying: false,
      isDead: false,
      deathTimer: 0,
      deathFrameIndex: DEATH_FRAMES[0],
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
      stationaryTime: bug.stationaryTime,
      blockedTurnDirection: bug.blockedTurnDirection,
      health: bug.health,
      spriteKey: bug.spriteKey,
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
    const canFreeSpin = bug.stationaryTime >= STUCK_SPIN_UNLOCK_SECONDS;

    if (bug.blockedTurnDirection !== 0 || canFreeSpin) {
      targetRotation = normalizeAngle(
        bug.rotation +
          (bug.blockedTurnDirection === 0
            ? pickBlockedTurnDirection()
            : bug.blockedTurnDirection) *
            (Math.PI / 2),
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
    if (bug.blockedTurnDirection === 0 && !canFreeSpin) {
      targetRotation = steerAwayFromBugs(bug, otherBugs, targetRotation);
    }

    const turnSpeed =
      bug.blockedFrames > 0 || canFreeSpin ? BLOCKED_TURN_SPEED : TURN_SPEED;
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

  function getSpriteKeyForHealth(health) {
    if (health >= BUG_MAX_HEALTH) {
      return "health100";
    }
    if (health >= 80) {
      return "health80";
    }
    if (health > 40) {
      return "health40";
    }
    return "health0";
  }

  function advanceWalkSpriteFrame(bug) {
    const currentIndex = WALK_FRAMES.indexOf(bug.frameIndex);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % WALK_FRAMES.length;
    bug.frameIndex = WALK_FRAMES[nextIndex];
  }

  function startBugDeath(bug) {
    bug.health = 0;
    bug.isDying = true;
    bug.isDead = false;
    bug.deathTimer = 0;
    bug.deathFrameIndex = DEATH_FRAMES[0];
    bug.spriteKey = "health0";
    bug.blockedFrames = 0;
    bug.stationaryTime = 0;
    bug.blockedTurnDirection = 0;
  }

  function updateBugDeath(bug, deltaSeconds) {
    bug.deathTimer += deltaSeconds;
    const progress = clamp(bug.deathTimer / DEATH_ANIMATION_DURATION, 0, 0.999999);
    const deathFrameCursor = Math.floor(progress * DEATH_FRAMES.length);
    bug.deathFrameIndex = DEATH_FRAMES[deathFrameCursor];

    if (bug.deathTimer >= DEATH_ANIMATION_DURATION) {
      bug.isDead = true;
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function damageBugsUnderMagnifier(bugs, deltaSeconds) {
    bugs.forEach((bug) => {
      if (bug.isDying) {
        return;
      }

      if (isBugInsideMagnifier(bug)) {
        bug.health = Math.max(
          0,
          bug.health - MAGNIFIER_DAMAGE_PER_SECOND * deltaSeconds,
        );
        const nextSpriteKey = getSpriteKeyForHealth(bug.health);
        if (nextSpriteKey !== bug.spriteKey) {
          bug.spriteKey = nextSpriteKey;
          advanceWalkSpriteFrame(bug);
        }
      }
    });
  }

  function isBugInsideMagnifier(bug) {
    if (!isPointerInsideCanvas || !pointerPosition) {
      return false;
    }

    const dx = bug.position.x - pointerPosition.x;
    const dy = bug.position.y - pointerPosition.y;
    return Math.hypot(dx, dy) <= MAGNIFIER_RADIUS;
  }

  function setMobileMode(nextValue) {
    isMobileMode = nextValue;
    canvas.style.cursor = isMobileMode ? "default" : "none";
    canvas.style.touchAction = isMobileMode ? "none" : "auto";
    mobileDragPointerId = null;
    mobileDragClientPosition = null;

    if (isMobileMode) {
      isPointerInsideCanvas = true;
      pointerPosition = getDefaultMagnifierPosition();
    } else if (!pointerPosition) {
      isPointerInsideCanvas = false;
    }

    updateMobileModeUi();
  }

  function updateMobileModeUi() {
    mobileModeToggle.textContent = isMobileMode
      ? "Mobile mode: on"
      : "Mobile mode: off";
    mobileModeToggle.setAttribute("aria-pressed", String(isMobileMode));
  }

  function updatePointerPositionFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nextPosition = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };

    pointerPosition = clampPointerPosition(nextPosition);
  }

  function getDefaultMagnifierPosition() {
    return clampPointerPosition({
      x: MAGNIFIER_HOTSPOT_X,
      y: MAGNIFIER_HOTSPOT_Y,
    });
  }

  function startMobileDrag(event) {
    mobileDragPointerId = event.pointerId;
    mobileDragClientPosition = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function updateMobileDrag(event) {
    if (mobileDragPointerId !== event.pointerId || !mobileDragClientPosition) {
      return;
    }

    const deltaX = event.clientX - mobileDragClientPosition.x;
    const deltaY = event.clientY - mobileDragClientPosition.y;

    pointerPosition = clampPointerPosition({
      x: (pointerPosition ? pointerPosition.x : getDefaultMagnifierPosition().x) + deltaX,
      y: (pointerPosition ? pointerPosition.y : getDefaultMagnifierPosition().y) + deltaY,
    });
    mobileDragClientPosition = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  function stopMobileDrag(event) {
    if (event && mobileDragPointerId !== event.pointerId) {
      return;
    }

    mobileDragPointerId = null;
    mobileDragClientPosition = null;
  }

  function clampPointerPosition(position) {
    if (!position) {
      return position;
    }

    if (!isMobileMode) {
      return {
        x: clamp(position.x, 0, viewport.width),
        y: clamp(position.y, 0, viewport.height),
      };
    }

    const magnifierDrawWidth = magnifierImage
      ? magnifierImage.width * MAGNIFIER_SCALE
      : MAGNIFIER_RADIUS * 2;
    const magnifierDrawHeight = magnifierImage
      ? magnifierImage.height * MAGNIFIER_SCALE
      : MAGNIFIER_RADIUS * 2;

    return {
      x: clamp(
        position.x,
        Math.min(MAGNIFIER_HOTSPOT_X, viewport.width / 2),
        Math.max(viewport.width / 2, viewport.width - (magnifierDrawWidth - MAGNIFIER_HOTSPOT_X)),
      ),
      y: clamp(
        position.y,
        Math.min(MAGNIFIER_HOTSPOT_Y, viewport.height / 2),
        Math.max(viewport.height / 2, viewport.height - (magnifierDrawHeight - MAGNIFIER_HOTSPOT_Y)),
      ),
    };
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

  function drawBugHealth(targetContext, bug) {
    const healthRatio = clamp(bug.health / BUG_MAX_HEALTH, 0, 1);
    const barWidth = 68;
    const barHeight = 4;
    const borderRadius = barHeight / 2;
    const minInnerWidth = 2;
    const innerWidth = Math.max(minInnerWidth, barWidth * healthRatio);
    const x = bug.position.x;
    const y = bug.position.y - BUG_DRAW_HEIGHT * bug.zoom * 0.62;
    const innerLeft = x - innerWidth / 2;
    const innerTop = y - barHeight + 10;

    targetContext.save();
    drawRoundedRectPath(
      targetContext,
      innerLeft,
      innerTop,
      innerWidth,
      barHeight,
      borderRadius,
    );
    targetContext.fillStyle = getHealthBarColor(healthRatio);
    targetContext.fill();
    targetContext.restore();
  }

  function getHealthBarColor(healthRatio) {
    const hue = 120 * healthRatio;
    return `hsl(${hue}deg 90% 50%)`;
  }

  function drawRoundedRectPath(targetContext, x, y, width, height, radius) {
    const clampedRadius = Math.min(radius, width / 2, height / 2);
    targetContext.beginPath();
    targetContext.moveTo(x + clampedRadius, y);
    targetContext.arcTo(x + width, y, x + width, y + height, clampedRadius);
    targetContext.arcTo(x + width, y + height, x, y + height, clampedRadius);
    targetContext.arcTo(x, y + height, x, y, clampedRadius);
    targetContext.arcTo(x, y, x + width, y, clampedRadius);
    targetContext.closePath();
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
