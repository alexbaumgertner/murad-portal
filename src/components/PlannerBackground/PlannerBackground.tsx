import { GRAIN_DATA_URI, grainTilePx, rgba, type Background } from '@/features/planner/appearance'

import styles from './PlannerBackground.module.css'

const SIZE: Record<Background['mode'], string> = {
  cover: 'cover',
  contain: 'contain',
  center: 'auto',
  fit: '100% 100%',
}

/**
 * Four stacked layers behind the sheet (story 026): color → image (blur and brightness live on
 * THIS layer only) → dark/light overlay → grain. The planner content sits above all of them,
 * so nothing here can blur or speckle text and controls.
 */
export function PlannerBackground({ background }: { background: Background }) {
  const { color, opacity, image, mode, blur, brightness, overlay, grain, grainSize } = background
  return (
    <div
      className={styles.stack}
      aria-hidden="true"
      style={{ backgroundColor: rgba(color, opacity) }}
    >
      {image ? (
        <div
          className={styles.image}
          data-testid="planner-bg-image"
          style={{
            backgroundImage: `url("${image}")`,
            backgroundSize: SIZE[mode],
            // The layer is oversized by the blur radius so blurred edges never show a halo.
            inset: `${-2 * blur}px`,
            filter: `blur(${blur}px) brightness(${brightness}%)`,
          }}
        />
      ) : null}
      {overlay !== 0 ? (
        <div
          className={styles.fill}
          data-testid="planner-bg-overlay"
          style={{
            backgroundColor:
              overlay < 0
                ? `rgba(0, 0, 0, ${Math.abs(overlay) / 100})`
                : `rgba(255, 255, 255, ${overlay / 100})`,
          }}
        />
      ) : null}
      {grain > 0 ? (
        <div
          className={styles.grain}
          data-testid="planner-bg-grain"
          style={{
            backgroundImage: GRAIN_DATA_URI,
            backgroundSize: `${grainTilePx(grainSize)}px`,
            opacity: grain / 100,
          }}
        />
      ) : null}
    </div>
  )
}
