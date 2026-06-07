import { test, expect } from '@playwright/test'

test.describe('Modo manual — fluxo completo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat-app/')
    await page.getByLabel('Nome').fill('Tester E2E')
    await page.getByLabel('API Key OpenRouter').fill('sk-test-mock-key')
    await page.getByRole('button', { name: 'Criar nova sala' }).click()
    await page.waitForURL(/\/room\//)
    await page.waitForSelector('.message-list')
  })

  test('em modo manual, enviar mensagem não dispara análise automática', async ({ page }) => {
    // Garante modo manual
    await page.getByRole('button', { name: 'Manual' }).click()

    await page.getByRole('textbox').fill('I goes to the store yesterday.')
    await page.keyboard.press('Enter')

    await page.waitForSelector('.message-bubble')
    await expect(page.getByText('Coach analisando...')).not.toBeVisible()
  })

  test('em modo manual, botão "Analisar com agente" aparece após envio', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual' }).click()

    await page.getByRole('textbox').fill('She does not like coffee.')
    await page.keyboard.press('Enter')

    await page.waitForSelector('.message-bubble')
    await expect(page.getByRole('button', { name: 'Analisar com agente' })).toBeVisible()
  })

  test('clicar "Analisar com agente" exibe resposta do coach mock', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual' }).click()

    await page.getByRole('textbox').fill('He have many friends.')
    await page.keyboard.press('Enter')

    await page.waitForSelector('.message-bubble')
    await page.getByRole('button', { name: 'Analisar com agente' }).click()

    await expect(page.getByText('[mock] Your text looks great!')).toBeVisible({ timeout: 10_000 })
  })

  test('Ctrl+Enter em modo manual envia com análise imediata', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual' }).click()

    await page.getByRole('textbox').fill('We was happy.')
    await page.keyboard.press('Control+Enter')

    await expect(page.getByText('[mock] Your text looks great!')).toBeVisible({ timeout: 10_000 })
  })
})
