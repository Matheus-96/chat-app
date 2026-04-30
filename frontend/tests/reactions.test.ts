// Unit test for Reaction components
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactionBar } from '@/components/ui/ReactionBar';
import { useReactions } from '@/hooks/useReactions';

jest.mock('@/hooks/useReactions', () => ({
  useReactions: jest.fn(),
}));

const mockData = {
  summary: {
    messageId: 'msg1',
    counts: { '👍': 2, '👎': 0, '😂': 1, '❤️': 3 },
    users: {},
  },
};

describe('ReactionBar', () => {
  beforeEach(() => {
    (useReactions as jest.Mock).mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
      addReaction: jest.fn(),
      removeReaction: jest.fn(),
    });
  });

  test('renders reaction buttons with counts', () => {
    render(<ReactionBar messageId='msg1' />);
    expect(screen.getByLabelText('React with 👍')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByLabelText('React with 😂')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
