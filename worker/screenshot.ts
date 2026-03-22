import path from 'path'
import { chromium, type Page } from 'playwright'

/**
 * Waits for the page to finish its initial load sequence:
 * 1. A minimum delay to let JS-driven loaders initialize
 * 2. Polls until any full-screen loader / preloader overlay is gone
 * 3. A short settle delay for fade-out transitions to complete
 *
 * Falls back gracefully — never throws, so capture always proceeds.
 */
async function waitForPageReady(page: Page): Promise<void> {
  // Let JS run and any percentage-based loaders start animating
  await page.waitForTimeout(1500)

  // Wait for large overlay elements that match common loader naming patterns
  // to either disappear from DOM or become invisible.
  // We only block on elements that cover ≥80% of the viewport (real loaders),
  // not small spinner widgets embedded in content.
  await page.waitForFunction(
    () => {
      const sel = [
        '[class*="loader"]',
        '[class*="loading"]',
        '[class*="preloader"]',
        '[class*="splash"]',
        '[class*="intro"]',
        '[class*="overlay"]',
        '[id*="loader"]',
        '[id*="loading"]',
        '[id*="preloader"]',
        '[id*="splash"]',
      ].join(',')

      const elements = Array.from(document.querySelectorAll(sel))
      if (elements.length === 0) return true

      return elements.every((el) => {
        const s = window.getComputedStyle(el)
        // Hidden via CSS
        if (s.display === 'none' || s.visibility === 'hidden') return true
        if (parseFloat(s.opacity) < 0.05) return true
        // Only treat it as a blocker if it covers most of the screen
        const r = el.getBoundingClientRect()
        const coversScreen =
          r.width >= window.innerWidth * 0.8 &&
          r.height >= window.innerHeight * 0.8
        return !coversScreen
      })
    },
    { timeout: 12_000 }
  ).catch(() => {
    // Timeout or evaluation error — proceed anyway
  })

  // Allow fade-out transitions to finish before we measure height
  await page.waitForTimeout(800)
}

/**
 * Forcefully removes common cookie banners, consent popups, and other obtrusive
 * overlays that might block the page content.
 */
async function removeOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    // 1. Target by common IDs and classes (case-insensitive)
    const commonSelectors = [
      '[id*="cookie" i]', '[class*="cookie" i]',
      '[id*="consent" i]', '[class*="consent" i]',
      '[id*="onetrust" i]', '[class*="onetrust" i]',
      '[id*="gdpr" i]', '[class*="gdpr" i]',
      '[id*="privacy" i]', '[class*="privacy" i]',
      '[id*="notice" i]', '[class*="notice" i]',
      '#CybotCookiebotDialog',
      '#qc-cmp2-container',
      '#didomi-host',
      '#cookiescript_injected',
      '#cookiescript_injected_wrapper',
      '.cc-window',
      '.cc-banner',
      '.osano-cm-window',
      '#trustarc-consent-track',
    ]

    commonSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        // Only remove if it looks like an overlay (fixed/absolute and high z-index)
        // or if it's a known library selector.
        const s = window.getComputedStyle(el)
        const isOverlay = s.position === 'fixed' || s.position === 'absolute'
        const hasHighZ = parseInt(s.zIndex) > 100

        // If it's a known library ID or a fixed/high-z element with matching keywords, remove it.
        if (isOverlay || hasHighZ || sel.startsWith('#') || sel.includes('cookie') || sel.includes('consent')) {
          el.remove()
        }
      })
    })

    // 2. Unlock scrolling — many sites lock body scroll when a modal is active
    document.body.style.setProperty('overflow', 'auto', 'important')
    document.body.style.setProperty('position', 'static', 'important')
    document.documentElement.style.setProperty('overflow', 'auto', 'important')
  })
}

export async function captureScreenshots(
  url: string,
  options: { width: number; height: number; fps: number; duration: number; frames: number },
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
      waitUntil: 'load',
      timeout: 60_000,
    })

    if (response && !response.ok()) {
      throw new Error(`Site returned HTTP ${response.status()}`)
    }

    // Wait for loaders / splash screens to finish before measuring the page
    await waitForPageReady(page)

    // Remove cookie banners and other obtrusive overlays
    await removeOverlays(page)

    // Disable smooth scrolling so scrollTo jumps instantly
    await page.addStyleTag({
      content: '*, *::before, *::after { scroll-behavior: auto !important; }',
    })

    // Calculate full page height AFTER loaders are gone so the real content
    // height is reflected (a covering loader skews scrollHeight to ~viewport)
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
    const totalFrames = options.frames
    const scrollStep = totalFrames > 1 ? maxScroll / (totalFrames - 1) : 0
    const framePaths: string[] = []

    for (let i = 0; i < totalFrames; i++) {
      const scrollPos = i * scrollStep
      await page.evaluate((y) => window.scrollTo(0, y), scrollPos)
      // Wait for the browser to paint the new scroll position before capturing
      await page.waitForTimeout(120)
      const framePath = path.join(tempDir, `frame-${String(i).padStart(4, '0')}.png`)
      await page.screenshot({ type: 'png', path: framePath })
      framePaths.push(framePath)
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
