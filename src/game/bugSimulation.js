const TWO_PI = Math.PI * 2;
const WALK_FRAMES = [1, 2, 3, 4, 5, 6];
const WALK_FRAME_DURATION = 0.1;
const MOVE_SPEED = 110;
const TURN_SPEED = 1.9;
const EDGE_PADDING = 90;
const RANDOM_TURN_MIN_INTERVAL = 1.5;
const RANDOM_TURN_MAX_INTERVAL = 4.5;

export function createBugSimulation() {
  const state = {
    bounds: { width: window.innerWidth, height: window.innerHeight },
    position: {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    },
    rotation: 0,
    targetRotation: 0,
    frameIndex: WALK_FRAMES[0],
    frameTimer: 0,
    turnCooldown: randomRange(RANDOM_TURN_MIN_INTERVAL, RANDOM_TURN_MAX_INTERVAL),
  };

  return {
    resize(width, height) {
      state.bounds.width = width;
      state.bounds.height = height;
      state.position.x = clamp(state.position.x, safeMinX(width), safeMaxX(width));
      state.position.y = clamp(state.position.y, safeMinY(height), safeMaxY(height));
    },

    update(deltaSeconds) {
      state.turnCooldown -= deltaSeconds;

      if (state.turnCooldown <= 0) {
        state.targetRotation = normalizeAngle(
          state.rotation + randomRange(-Math.PI / 2, Math.PI / 2),
        );
        state.turnCooldown = randomRange(
          RANDOM_TURN_MIN_INTERVAL,
          RANDOM_TURN_MAX_INTERVAL,
        );
      }

      steerAwayFromEdges(state);
      state.rotation = rotateTowards(
        state.rotation,
        state.targetRotation,
        TURN_SPEED * deltaSeconds,
      );

      const direction = {
        x: Math.sin(state.rotation),
        y: -Math.cos(state.rotation),
      };

      state.position.x += direction.x * MOVE_SPEED * deltaSeconds;
      state.position.y += direction.y * MOVE_SPEED * deltaSeconds;
      state.position.x = clamp(
        state.position.x,
        safeMinX(state.bounds.width),
        safeMaxX(state.bounds.width),
      );
      state.position.y = clamp(
        state.position.y,
        safeMinY(state.bounds.height),
        safeMaxY(state.bounds.height),
      );

      state.frameTimer += deltaSeconds;
      while (state.frameTimer >= WALK_FRAME_DURATION) {
        state.frameTimer -= WALK_FRAME_DURATION;
        const currentIndex = WALK_FRAMES.indexOf(state.frameIndex);
        state.frameIndex = WALK_FRAMES[(currentIndex + 1) % WALK_FRAMES.length];
      }
    },

    getState() {
      return {
        position: { ...state.position },
        rotation: state.rotation,
        frameIndex: state.frameIndex,
      };
    },
  };
}

function steerAwayFromEdges(state) {
  const { width, height } = state.bounds;
  const nearLeft = state.position.x < EDGE_PADDING;
  const nearRight = state.position.x > width - EDGE_PADDING;
  const nearTop = state.position.y < EDGE_PADDING;
  const nearBottom = state.position.y > height - EDGE_PADDING;

  if (!(nearLeft || nearRight || nearTop || nearBottom)) {
    return;
  }

  const centerAngle = Math.atan2(
    width / 2 - state.position.x,
    -(height / 2 - state.position.y),
  );
  state.targetRotation = normalizeAngle(centerAngle);
}

function rotateTowards(current, target, maxStep) {
  const delta = shortestAngleDelta(current, target);
  if (Math.abs(delta) <= maxStep) {
    return normalizeAngle(target);
  }

  return normalizeAngle(current + Math.sign(delta) * maxStep);
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

function safeMinX(width) {
  return Math.min(EDGE_PADDING / 2, width / 2);
}

function safeMaxX(width) {
  return Math.max(width / 2, width - EDGE_PADDING / 2);
}

function safeMinY(height) {
  return Math.min(EDGE_PADDING / 2, height / 2);
}

function safeMaxY(height) {
  return Math.max(height / 2, height - EDGE_PADDING / 2);
}
