/** Two small, staggered wisps, injected gradually rather than pre-filled. */
export function entranceSplats(time, dt) {
  const splats = [];
  for (const side of [-1, 1]) {
    const progress = (time - (side === -1 ? 0.65 : 1.15)) / 2.6;
    if (progress <= 0 || progress >= 1) continue;
    const envelope = Math.sin(Math.PI * progress) ** 2;
    const depth = progress * 0.48;
    splats.push([
      0.5 + side * (0.265 - depth * 0.19),
      0.73 - depth * 0.38,
      side * Math.sin(progress * Math.PI * 2) * 7 * dt * 60,
      -9 * dt * 60,
      envelope * dt * 0.48,
      0.00065,
    ]);
  }
  return splats;
}
