// This file serves both as a Jest unit test (for React Testing Library) and a Playwright end‑to‑end test.
// The two test blocks are guarded by environment checks so that only one framework executes the relevant code.

// ------- Jest imports -------
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactionBar } from '@/components/ui/ReactionBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// ------- Playwright imports -------
import { test as pwTest, expect as pwExpect } from '@playwright/test';

// ---- Helper to wrap React components for React Query -------
const createWrapper = (children: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children
  );
};

// ----------------- Jest Unit Tests -----------------
if (process.env.JEST_WORKER_ID) {
  const mock = new MockAdapter(axios);
  const messageId = 'msg1';
  const apiUrl = `/api/messages/${messageId}/reactions`;

  beforeEach(() => {
    mock.reset();
  });

  test('renders loading state initially', async () => {
    mock.onGet(apiUrl).reply(200, { counts: {} });
    render(createWrapper(<ReactionBar messageId={messageId} />));
    expect(screen.getByText(/Loading…/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Loading…/i)).not.toBeInTheDocument());
  });

  test('displays reaction buttons and allows adding a reaction', async () => {
    const counts = { '👍': 2, '❤️': 1 };
    mock.onGet(apiUrl).reply(200, { counts });
    mock.onPost(apiUrl).reply(200);

    render(createWrapper(<ReactionBar messageId={messageId} />));
    await waitFor(() => expect(screen.queryByText(/Loading…/i)).not.toBeInTheDocument());
    // Verify existing reaction counts
    expect(screen.getByRole('button', { name: /React with 👍/i })).toHaveTextContent('👍2');
    expect(screen.getByRole('button', { name: /React with ❤️/i })).toHaveTextContent('❤️1');
    // Open picker
    fireEvent.click(screen.getByRole('button', { name: /Add reaction/i }));
    // Pick an emoji
    const pickButton = await screen.findByRole('button', { name: /Select 😂/i });
    fireEvent.click(pickButton);
    // Ensure POST was called
    expect(mock.history.post.length).toBe(1);
    // Picker should close
    await waitFor(() => expect(pickButton).not.toBeInTheDocument());
  });
}

// ----------------- Playwright E2E Test -----------------
if (!process.env.JEST_WORKER_ID) {
  pwTest('full reaction flow', async ({ page }) => {
    // Since there is no real API server, we stub network requests using Playwright Route.
    await page.route('**/api/messages/*/reactions', route => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ counts: {} }) });
      } else if (method === 'POST') {
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });

    // Render a simple wrapper page that includes ReactionBar
    await page.setContent(`
      <html><body>
        <div id="root"></div>
        <script type="module">
          import { createRoot } from 'react-dom/client';
          import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
          import { ReactionBar } from './components/ui/ReactionBar';
          const root = createRoot(document.getElementById('root'));
          const queryClient = new QueryClient({defaultOptions:{queries:{retry:false}}});
          root.render(
            React.createElement(QueryClientProvider,{client:queryClient},
              React.createElement(ReactionBar,{messageId:'msg1'}))
          );
        </script>
      </body></html>`);
    await pwExpect(page.locator('text=Loading…')).toBeVisible();
    await pwExpect(page.locator('text=Loading…')).toBeHidden();
    await pwExpect(page.locator('button[aria-label="Add reaction"]')).toBeVisible();
    await page.locator('button[aria-label="Add reaction"]').click();
    await pwExpect(page.locator('button[aria-label="Select ❤️"]')).toBeVisible();
  });
}
