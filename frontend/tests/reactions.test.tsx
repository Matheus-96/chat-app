// Unit tests for ReactionBar component
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactionBar } from '@/components/ui/ReactionBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock axios
const mock = new MockAdapter(axios);

const createWrapper = (children: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('ReactionBar', () => {
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
});
