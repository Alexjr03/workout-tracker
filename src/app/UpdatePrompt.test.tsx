import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

describe('UpdatePrompt', () => {
  it('renders nothing when no update is waiting', () => {
    const { container } = render(
      <UpdatePrompt
        needRefresh={false}
        suppressed={false}
        onUpdate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden during an active session', () => {
    const { container } = render(
      <UpdatePrompt needRefresh suppressed onUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers update and later when an update is waiting', async () => {
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UpdatePrompt needRefresh suppressed={false} onUpdate={onUpdate} onDismiss={onDismiss} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Update ready');
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
