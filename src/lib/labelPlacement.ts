export interface Box2D {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PointLabelInput {
  id: string;
  px: number;
  py: number;
  radius: number;
  w: number;
  h: number;
  priority?: number;
}

export interface PlacedPointLabel {
  id: string;
  box: Box2D;
  textAnchor: 'start' | 'middle' | 'end';
  textX: number;
  textY: number;
  needsLeader: boolean;
  leaderX2: number;
  leaderY2: number;
}

export function boxesOverlap(a: Box2D, b: Box2D, pad = 2): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

export function overlapArea(a: Box2D, b: Box2D): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

/**
 * Greedily places SVG point labels around plotted markers so that no two labels overlap
 * each other, point markers, or reserved chart bounds / captions.
 */
export function resolvePointLabels(
  points: PointLabelInput[],
  bounds: Box2D,
  reservedBoxes: Box2D[] = []
): Record<string, PlacedPointLabel> {
  // Reserve circular dots so labels don't draw on top of neighbor dots
  const dotObstacles: Box2D[] = points.map((pt) => ({
    x: pt.px - pt.radius - 2,
    y: pt.py - pt.radius - 2,
    w: (pt.radius + 2) * 2,
    h: (pt.radius + 2) * 2,
  }));

  const occupied: Box2D[] = [...reservedBoxes, ...dotObstacles];
  const sorted = [...points].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const placedMap: Record<string, PlacedPointLabel> = {};

  // Multi-ring radial candidate offsets (near first, then nudged outward with leader line)
  const offsets: Array<{
    dx: number;
    dy: number;
    anchor: 'start' | 'middle' | 'end';
    leader: boolean;
  }> = [
    { dx: 1, dy: 0, anchor: 'start', leader: false },
    { dx: -1, dy: 0, anchor: 'end', leader: false },
    { dx: 0, dy: -1, anchor: 'middle', leader: false },
    { dx: 0, dy: 1, anchor: 'middle', leader: false },
    { dx: 0.9, dy: -0.9, anchor: 'start', leader: false },
    { dx: -0.9, dy: -0.9, anchor: 'end', leader: false },
    { dx: 0.9, dy: 0.9, anchor: 'start', leader: false },
    { dx: -0.9, dy: 0.9, anchor: 'end', leader: false },
    // Extended leader-line tier
    { dx: 2.2, dy: -1.4, anchor: 'start', leader: true },
    { dx: -2.2, dy: -1.4, anchor: 'end', leader: true },
    { dx: 2.2, dy: 1.5, anchor: 'start', leader: true },
    { dx: -2.2, dy: 1.5, anchor: 'end', leader: true },
    { dx: 0, dy: -2.4, anchor: 'middle', leader: true },
    { dx: 0, dy: 2.5, anchor: 'middle', leader: true },
    { dx: 3.4, dy: 0, anchor: 'start', leader: true },
    { dx: -3.4, dy: 0, anchor: 'end', leader: true },
  ];

  for (const pt of sorted) {
    let bestCandidate: PlacedPointLabel | null = null;
    let bestScore = Infinity;

    for (let idx = 0; idx < offsets.length; idx++) {
      const off = offsets[idx];
      const gap = off.leader ? pt.radius + 14 : pt.radius + 6;

      let boxX = pt.px;
      let boxY = pt.py - pt.h / 2;

      if (off.anchor === 'start') {
        boxX = pt.px + off.dx * gap;
      } else if (off.anchor === 'end') {
        boxX = pt.px + off.dx * gap - pt.w;
      } else {
        boxX = pt.px - pt.w / 2;
      }

      if (off.dy < 0) {
        boxY = pt.py + off.dy * gap - pt.h * (Math.abs(off.dy) >= 1 ? 1 : 0.5);
      } else if (off.dy > 0) {
        boxY = pt.py + off.dy * gap;
      }

      // Clamp to inner bounds
      const clampedX = Math.max(bounds.x + 2, Math.min(bounds.x + bounds.w - pt.w - 2, boxX));
      const clampedY = Math.max(bounds.y + 2, Math.min(bounds.y + bounds.h - pt.h - 2, boxY));
      const box: Box2D = { x: clampedX, y: clampedY, w: pt.w, h: pt.h };

      let penalty = idx * 0.5;
      if (clampedX !== boxX || clampedY !== boxY) penalty += 25;

      for (const obs of occupied) {
        const area = overlapArea(box, obs);
        if (area > 0) penalty += 500 + area;
      }

      const textX =
        off.anchor === 'start'
          ? clampedX
          : off.anchor === 'end'
            ? clampedX + pt.w
            : clampedX + pt.w / 2;
      const textY = clampedY + pt.h * 0.42;

      const leaderX2 =
        off.anchor === 'start'
          ? clampedX - 2
          : off.anchor === 'end'
            ? clampedX + pt.w + 2
            : clampedX + pt.w / 2;
      const leaderY2 = clampedY + pt.h / 2;

      const movedDist = Math.hypot(leaderX2 - pt.px, leaderY2 - pt.py);
      const needsLeader = off.leader || movedDist > pt.radius + 14;

      if (penalty < bestScore) {
        bestScore = penalty;
        bestCandidate = {
          id: pt.id,
          box,
          textAnchor: off.anchor,
          textX,
          textY,
          needsLeader,
          leaderX2,
          leaderY2,
        };
        if (penalty < 10) break; // Zero overlap found cleanly
      }
    }

    if (bestCandidate) {
      occupied.push(bestCandidate.box);
      placedMap[pt.id] = bestCandidate;
    }
  }

  return placedMap;
}
