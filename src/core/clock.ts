/**
 * Single source of "now" for the display. `offset` lets you preview any moment
 * (e.g. `?at=12:29` opens the screen just before Dhuhr's adhan) without touching
 * the TV's clock.
 */
export const clock = {
  offset: 0,
  now: () => new Date(Date.now() + clock.offset),
};
