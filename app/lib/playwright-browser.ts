import { Browser, BrowserContext, Page, chromium } from 'playwright';

export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  url: string;
}

class PlaywrightBrowserService {
  private sessions: Map<string, BrowserSession> = new Map();

  async createSession(): Promise<{ sessionId: string; sessionUrl: string }> {
    const sessionId = this.generateSessionId();
    
    // Launch browser with specific options
    const browser = await chromium.launch({
      headless: false, // Set to true in production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // Create context with viewport
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Create page
    const page = await context.newPage();
    
    // Set default timeout
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    const session: BrowserSession = {
      id: sessionId,
      browser,
      context,
      page,
      url: 'about:blank'
    };

    this.sessions.set(sessionId, session);

    return {
      sessionId,
      sessionUrl: 'about:blank' // We'll update this after navigation
    };
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.context.close();
      await session.browser.close();
      this.sessions.delete(sessionId);
    }
  }

  async navigateTo(sessionId: string, url: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    await session.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    session.url = url;
  }

  async performAction(sessionId: string, instruction: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const page = session.page;

    // Parse instruction and perform action
    // This is a simplified version - you might want to add more sophisticated parsing
    if (instruction.includes('click')) {
      const selector = this.extractSelector(instruction);
      await page.click(selector);
    } else if (instruction.includes('type') || instruction.includes('fill')) {
      const match = instruction.match(/type\s+"([^"]+)"\s+in\s+(.+)|fill\s+(.+)\s+with\s+"([^"]+)"/i);
      if (match) {
        const text = match[1] || match[4];
        const selector = match[2] || match[3];
        await page.fill(selector.trim(), text);
      }
    } else if (instruction.includes('press')) {
      const key = instruction.match(/press\s+(\S+)/i)?.[1];
      if (key) {
        await page.keyboard.press(key);
      }
    }
    // Add more action types as needed
  }

  async extractContent(sessionId: string, instruction: string): Promise<any> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const page = session.page;

    // Simple extraction logic - enhance as needed
    if (instruction.includes('text')) {
      const selector = this.extractSelector(instruction) || 'body';
      return await page.textContent(selector);
    } else if (instruction.includes('title')) {
      return await page.title();
    } else if (instruction.includes('url')) {
      return page.url();
    }

    // Default: get all text
    return await page.textContent('body');
  }

  async observe(sessionId: string, instruction: string): Promise<any[]> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const page = session.page;

    // Find elements based on instruction
    const elements = await page.$$eval('a, button, input, textarea, select', (els) => {
      return els.map(el => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim() || '',
        placeholder: (el as HTMLInputElement).placeholder || '',
        href: (el as HTMLAnchorElement).href || '',
        type: (el as HTMLInputElement).type || '',
        visible: el instanceof HTMLElement ? el.offsetParent !== null : true
      }));
    });

    return elements.filter(el => el.visible);
  }

  async takeScreenshot(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const screenshot = await session.page.screenshot({
      type: 'png',
      fullPage: false
    });

    return screenshot.toString('base64');
  }

  async goBack(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    await session.page.goBack();
  }

  async wait(sessionId: string, ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async getCurrentUrl(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    return session.page.url();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractSelector(instruction: string): string {
    // Simple selector extraction - enhance as needed
    const match = instruction.match(/"([^"]+)"|'([^']+)'|(\S+)$/);
    return match ? (match[1] || match[2] || match[3]) : '';
  }
}

// Export singleton instance
export const playwrightBrowser = new PlaywrightBrowserService(); 