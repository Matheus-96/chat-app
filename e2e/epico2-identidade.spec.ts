import { test, expect, chromium } from '@playwright/test'

const BASE = 'http://localhost:5175/chat-app/'

test.describe('Épico 2 — Identidade sem Cadastro', () => {
  test('participantId gerado via sessionStorage, persiste na mesma aba', async ({ page }) => {
    await page.goto(BASE)
    const id1 = await page.evaluate(() => sessionStorage.getItem('chat.session.participantId'))
    expect(id1).toBeTruthy()
    expect(id1).toMatch(/^[0-9a-f-]{36}$/) // UUID format

    // Reload same tab — same id
    await page.reload()
    const id2 = await page.evaluate(() => sessionStorage.getItem('chat.session.participantId'))
    expect(id2).toBe(id1)
  })

  test('duas abas geram participantIds distintos', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    await page1.goto(BASE)
    await page2.goto(BASE)

    const id1 = await page1.evaluate(() => sessionStorage.getItem('chat.session.participantId'))
    const id2 = await page2.evaluate(() => sessionStorage.getItem('chat.session.participantId'))

    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)

    await ctx1.close()
    await ctx2.close()
  })

  test('nome, apiKey e customInstructions persistem no localStorage após salvar', async ({ page }) => {
    await page.goto(BASE)

    await page.getByPlaceholder('Como voce aparece na sala').fill('Maria')
    await page.getByPlaceholder('sk-or-v1-...').fill('sk-or-v1-testkey')
    await page.getByPlaceholder(/foque em erros/).fill('foque em preposicoes')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()

    const stored = await page.evaluate(() => ({
      name: localStorage.getItem('chat.profile.name'),
      apiKey: localStorage.getItem('chat.profile.apiKey'),
      customInstructions: localStorage.getItem('chat.profile.customInstructions'),
    }))
    expect(stored.name).toBe('Maria')
    expect(stored.apiKey).toBe('sk-or-v1-testkey')
    expect(stored.customInstructions).toBe('foque em preposicoes')
  })

  test('campos restaurados do localStorage após recarregar', async ({ page }) => {
    await page.goto(BASE)

    await page.getByPlaceholder('Como voce aparece na sala').fill('Pedro')
    await page.getByPlaceholder('sk-or-v1-...').fill('sk-or-v1-mykey')
    await page.getByPlaceholder(/foque em erros/).fill('vocabulario B2')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()

    // Reload the page
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const nameInput = page.getByPlaceholder('Como voce aparece na sala')
    await expect(nameInput).toHaveValue('Pedro')
    const apiInput = page.getByPlaceholder('sk-or-v1-...')
    await expect(apiInput).toHaveValue('sk-or-v1-mykey')
    const instInput = page.getByPlaceholder(/foque em erros/)
    await expect(instInput).toHaveValue('vocabulario B2')
  })

  test('agentMode NÃO está no localStorage', async ({ page }) => {
    await page.goto(BASE)
    await page.getByPlaceholder('Como voce aparece na sala').fill('Testador')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await page.getByRole('button', { name: 'Criar nova sala' }).click()
    await page.waitForURL(/\/room\//)

    const agentModeInStorage = await page.evaluate(() => {
      return Object.keys(localStorage).some(k => k.toLowerCase().includes('agentmode') || k.toLowerCase().includes('agent_mode'))
    })
    expect(agentModeInStorage).toBe(false)
  })

  test('customInstructions: contador regressivo e bloqueio acima de 250 chars', async ({ page }) => {
    await page.goto(BASE)

    const textarea = page.getByPlaceholder(/foque em erros/)
    const counter = page.locator('.profile-editor__counter, .profile-editor__counter--near, .profile-editor__counter--over')
    const submitBtn = page.getByRole('button', { name: 'Salvar perfil' })

    // Initially 250 chars remaining
    await expect(counter).toContainText('250 caracteres restantes')

    // Type 240 chars (10 remaining — no alert yet)
    const text240 = 'a'.repeat(240)
    await textarea.fill(text240)
    await expect(counter).toContainText('10 caracteres restantes')

    // Type 251 chars — over limit, button disabled
    const text251 = 'a'.repeat(251)
    await textarea.fill(text251)
    await expect(counter).toContainText('-1 caracteres restantes')
    await expect(submitBtn).toBeDisabled()

    // Back to 250 — button enabled again
    await textarea.fill('a'.repeat(250))
    await expect(submitBtn).toBeEnabled()
  })

  test('editar nome na sidebar atualiza localStorage e aparece na lista de participantes', async ({ page }) => {
    await page.goto(BASE)
    await page.getByPlaceholder('Como voce aparece na sala').fill('Nome Original')
    await page.getByRole('button', { name: 'Salvar perfil' }).click()
    await page.getByRole('button', { name: 'Criar nova sala' }).click()
    await page.waitForURL(/\/room\//)

    // Wait for connected state
    const statusCell = page.locator('dt:has-text("Status") + dd')
    await expect(statusCell).toContainText('connected', { timeout: 8000 })

    // Open profile editor in sidebar
    await page.getByRole('button', { name: 'Editar perfil' }).click()

    // Find the name input inside the profile editor (sidebar context)
    const sidebarNameInput = page.locator('.sidebar .profile-editor input').first()
    await sidebarNameInput.fill('Nome Editado')
    await page.locator('.sidebar .profile-editor').getByRole('button', { name: 'Salvar' }).click()

    // Name should update in participants list
    const participantsList = page.locator('.sidebar__list')
    await expect(participantsList).toContainText('Nome Editado', { timeout: 3000 })

    // localStorage should reflect the new name
    const storedName = await page.evaluate(() => localStorage.getItem('chat.profile.name'))
    expect(storedName).toBe('Nome Editado')
  })

  test('mudança de nome via WS propaga para segunda aba', async ({ browser }) => {
    // Create room with first context
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await page1.goto(BASE)
    await page1.getByPlaceholder('Como voce aparece na sala').fill('Participante A')
    await page1.getByRole('button', { name: 'Salvar perfil' }).click()
    await page1.getByRole('button', { name: 'Criar nova sala' }).click()
    await page1.waitForURL(/\/room\//)
    const roomUrl = page1.url()
    const roomCode = roomUrl.match(/\/room\/([A-Z0-9]+)/)?.[1]
    expect(roomCode).toBeTruthy()

    // Join same room with second context
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await page2.goto(BASE)
    await page2.getByPlaceholder('Como voce aparece na sala').fill('Participante B')
    await page2.getByRole('button', { name: 'Salvar perfil' }).click()
    await page2.getByPlaceholder('AB12CD ou URL completa').fill(roomCode!)
    await page2.getByRole('button', { name: 'Entrar em sala existente' }).click()
    await page2.waitForURL(/\/room\//)

    // Wait for both to be connected
    await expect(page1.locator('dt:has-text("Status") + dd')).toContainText('connected', { timeout: 8000 })
    await expect(page2.locator('dt:has-text("Status") + dd')).toContainText('connected', { timeout: 8000 })

    // page2 should see page1's name in participants list
    await expect(page2.locator('.sidebar__list')).toContainText('Participante A', { timeout: 5000 })

    // Edit name on page1
    await page1.getByRole('button', { name: 'Editar perfil' }).click()
    const sidebarNameInput = page1.locator('.sidebar .profile-editor input').first()
    await sidebarNameInput.fill('Nome Atualizado')
    await page1.locator('.sidebar .profile-editor').getByRole('button', { name: 'Salvar' }).click()

    // page2 should see the updated name without reloading
    await expect(page2.locator('.sidebar__list')).toContainText('Nome Atualizado', { timeout: 5000 })

    await ctx1.close()
    await ctx2.close()
  })
})
