/**
 * Draggable-orb animation presets (panel mode + `draggable` prop).
 *
 * Each preset describes:
 *   - squish       how much velocity-based squash/stretch to apply to the
 *                  orb while it's being dragged (0 = none)
 *   - rotateSquish use a pendulum-style tilt instead of squash/stretch
 *   - dropDuration / dropEasing
 *                  the CSS transition applied to left/top when the orb
 *                  snaps into its resting position after release
 *   - settleKeyframe
 *                  an optional one-shot CSS keyframe animation (name +
 *                  duration) played on the orb right after it lands, for
 *                  presets that bounce/wobble/pop into place
 */
export const ORB_ANIMATIONS = {
  none: {
    squish: 0, rotateSquish: false,
    dropDuration: 0, dropEasing: 'linear',
    settleKeyframe: null,
  },
  bubblegum: {
    squish: 1, rotateSquish: false,
    dropDuration: 500, dropEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    settleKeyframe: null,
  },
  smooth: {
    squish: 0, rotateSquish: false,
    dropDuration: 550, dropEasing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    settleKeyframe: null,
  },
  glide: {
    squish: 0, rotateSquish: false,
    dropDuration: 650, dropEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    settleKeyframe: null,
  },
  spring: {
    squish: 0, rotateSquish: false,
    dropDuration: 550, dropEasing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    settleKeyframe: null,
  },
  elastic: {
    squish: 0, rotateSquish: false,
    dropDuration: 650, dropEasing: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    settleKeyframe: { name: 'ce-orb-elastic-settle', duration: 500 },
  },
  rubberband: {
    squish: 1.6, rotateSquish: false,
    dropDuration: 600, dropEasing: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
    settleKeyframe: { name: 'ce-orb-rubberband-settle', duration: 600 },
  },
  jelly: {
    squish: 0.6, rotateSquish: false,
    dropDuration: 500, dropEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    settleKeyframe: { name: 'ce-orb-jelly-settle', duration: 700 },
  },
  wobble: {
    squish: 0, rotateSquish: true,
    dropDuration: 500, dropEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    settleKeyframe: { name: 'ce-orb-wobble-settle', duration: 500 },
  },
  pop: {
    squish: 0, rotateSquish: false,
    dropDuration: 450, dropEasing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    settleKeyframe: { name: 'ce-orb-pop-settle', duration: 350 },
  },
  magnetic: {
    squish: 0, rotateSquish: false,
    dropDuration: 280, dropEasing: 'cubic-bezier(0.55, 0, 0.1, 1)',
    settleKeyframe: { name: 'ce-orb-magnetic-glow', duration: 400 },
  },
};

// All selectable names besides 'none' — kept in one place so the library
// and consumers agree on what `config.orbAnimation` accepts.
export const ORB_ANIMATION_NAMES = Object.keys(ORB_ANIMATIONS).filter((n) => n !== 'none');

export function resolveOrbAnimation(name) {
  return ORB_ANIMATIONS[name] ?? ORB_ANIMATIONS.bubblegum;
}

/**
 * CSS transform applied to the orb WHILE it's being dragged, based on
 * recent pointer velocity (`squish` = { x, y }, already clamped/scaled by
 * the caller) and the active preset.
 */
export function dragTransform(preset, squish) {
  if (!preset || (preset.squish <= 0 && !preset.rotateSquish)) return 'none';
  if (preset.rotateSquish) {
    const rot = Math.min(Math.max(squish.x * 1.5, -18), 18);
    return `rotate(${rot}deg)`;
  }
  const mag = Math.hypot(squish.x, squish.y) * preset.squish;
  const angle = Math.atan2(squish.y, squish.x) * 180 / Math.PI;
  return `rotate(${angle}deg) scale(${1 + mag / 30}, ${1 - mag / 60}) rotate(${-angle}deg)`;
}
