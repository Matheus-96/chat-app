import { test } from '@playwright/test'

test('debug — snapshot da sala', async ({ page }) => {
  await page.goto('/chat-app/')
  await page.getByLabel('Nome').fill('Tester E2E')
  await page.getByLabel('API Key OpenRouter').fill('sk-test-mock-key')
  await page.getByRole('button', { name: 'Criar nova sala' }).click()
  await page.waitForURL(/\/room\//)
  await page.waitForSelector('.message-list')
  await page.screenshot({ path: 'e2e/debug-room.png', fullPage: true })
  // Lista todos os radio
  const radios = await page.getByRole('radio').all()
  for (const r of radios) {
    const text = await r.innerText()
    console.log('radio:', JSON.stringify(text))
  }
  // Lista todos os toggles por data-slot
  const toggleItems = await page.locator('[data-slot="toggle-group-item"]').all()
  for (const t of toggleItems) {
    const text = await t.innerText()
    const role = await t.getAttribute('role')
    console.log('toggle-group-item:', JSON.stringify(text), 'role:', role)
  }
})
