import type { Response } from '@playwright/test'

/**
 * A planner Server Action POST that writes (tick, appearance …), not the live-sync revision poll
 * (story 032), which posts the bare `[{"plannerId":N}]` to the same URL every few seconds.
 */
export const isPlannerSave = (response: Response): boolean =>
  response.request().method() === 'POST' &&
  response.url().includes('/study/planner') &&
  !/^\[\{"plannerId":\d+\}\]$/.test(response.request().postData() ?? '')
