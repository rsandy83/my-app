import { render, screen } from '@testing-library/react';
import App from './App';

test('renders JournalShare heading', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /journalshare/i });
  expect(heading).toBeInTheDocument();
});
