import path from 'path'
import { chromium } from 'playwright'
import type { JobOptions } from '../src/types/job'

export async function captureScreenshots(
  url: string,
  options: { width: number; height: number; fps: number; duration: number },
  tempDir: string
): Promise<string[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.setViewportSize({ width: options.width, height: options.height })

    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    })

    if (response && !response.ok()) {
      throw new Error(`Site returned HTTP ${response.status()}`)
    }

    // Wait for animations to settle
    await page.waitForTimeout(800)

    // Calculate full page height to determine scroll distance
    const fullHeight = await page.evaluate(() => {
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      )
    })
    
    const maxScroll = Math.max(0, fullHeight - options.height)

    const totalFrames = options.fps * options.duration
    const intervalMs = 1000 / options.fps
    const scrollStep = totalFrames > 1 ? maxScroll / (totalFrames - 1) : 0
    const framePaths: string[] = []

    for (let i = 0; i < totalFrames; i++) {
      const scrollPos = i * scrollStep
      await page.evaluate((y) => window.scrollTo(0, y), scrollPos)
      const framePath = path.join(tempDir, `frame-${String(i).padStart(4, '0')}.png`)
      await page.screenshot({ type: 'png', path: framePath })
      framePaths.push(framePath)
      if (i < totalFrames - 1) {
        await page.waitForTimeout(intervalMs)
      }
    }

    return framePaths.sort()
  } catch (err) {
    if ((err as Error).message?.includes('timeout')) {
      throw new Error('Page load timeout')
    }
    throw err
  } finally {
    await browser.close()
  }
}
