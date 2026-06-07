import { test, expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    __notifyCalls: Array<{ title: string; options?: NotificationOptions }>
  }
}

async function injectNotificationStub(page: Page) {
  await page.addInitScript(() => {
    window.__notifyCalls = []
    class NotificationStub {
      constructor(title: string, options?: NotificationOptions) {
        window.__notifyCalls.push({ title, options })
      }
      static permission: NotificationPermission = 'granted'
      static requestPermission() { return Promise.resolve('granted' as NotificationPermission) }
    }
    Object.defineProperty(window, 'Notification', { value: NotificationStub, configurable: true, writable: true })
  })
}

async function enterRoom(page: Page, name: string): Promise<string> {
  await page.goto('/chat-app/')
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('API Key OpenRouter').fill('sk-test-mock-key')
  await page.getByRole('button', { name: 'Criar nova sala' }).click()
  await page.waitForURL(/\/room\//)
  await page.waitForSelector('.message-list')
  await page.getByText(name).first().waitFor()
  return page.url().match(/\/room\/([A-Z0-9]+)/)?.[1] ?? ''
}

async function joinRoom(page: Page, code: string, name: string) {
  await page.goto('/chat-app/')
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('API Key OpenRouter').fill('sk-test-mock-key')
  await page.getByLabel('Codigo ou link da sala').fill(code)
  await page.getByRole('button', { name: 'Entrar em sala existente' }).click()
  await page.waitForURL(/\/room\//)
  await page.waitForSelector('.message-list')
  await page.getByText(name).first().waitFor()
}

test.describe('Notificações', () => {
  test('mensagem de outro participante dispara notificação quando aba está fora de foco', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    await ctx1.grantPermissions(['notifications'])

    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    await injectNotificationStub(page1)

    const roomCode = await enterRoom(page1, 'Alice')
    await joinRoom(page2, roomCode, 'Bob')

    // Aguarda Bob aparecer na lista de participantes de Alice
    await page1.getByText('Bob').waitFor({ timeout: 5_000 })

    // Simula aba fora de foco
    await page1.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    })

    // Bob envia mensagem
    await page2.getByPlaceholder('Escreva sua mensagem em ingles...').fill('Hello from Bob!')
    await page2.keyboard.press('Enter')

    // Aguarda a mensagem aparecer em Alice
    await page1.waitForSelector('.message-bubble', { timeout: 5_000 })

    const calls = await page1.evaluate(() => window.__notifyCalls)
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0].title).toBe('Bob')

    await ctx1.close()
    await ctx2.close()
  })

  test('mensagem própria não dispara notificação', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    await ctx1.grantPermissions(['notifications'])

    const page1 = await ctx1.newPage()
    await injectNotificationStub(page1)

    await enterRoom(page1, 'Alice')

    await page1.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    })

    await page1.getByPlaceholder('Escreva sua mensagem em ingles...').fill('My own message')
    await page1.keyboard.press('Enter')
    await page1.waitForSelector('.message-bubble')

    const calls = await page1.evaluate(() => window.__notifyCalls)
    expect(calls).toHaveLength(0)

    await ctx1.close()
  })
})
