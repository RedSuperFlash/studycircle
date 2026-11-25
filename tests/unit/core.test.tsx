import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Field, Form, RichText, Tabs } from '../../src/components/ui';
import { clock, timerPhase } from '../../src/lib/format';
import { demoStore } from '../../src/services/demo';

describe('timestamp-based timer', () => {
  const start = '2026-11-25T10:00:00Z';
  it('transitions between focus, break and complete', () => {
    expect(timerPhase(start, 25, 5, Date.parse('2026-11-25T10:10:30Z'))).toEqual({
      phase: 'Focus',
      remaining: 870,
    });
    expect(timerPhase(start, 25, 5, Date.parse('2026-11-25T10:25:00Z'))).toEqual({
      phase: 'Break',
      remaining: 300,
    });
    expect(timerPhase(start, 25, 5, Date.parse('2026-11-25T10:30:00Z'))).toEqual({
      phase: 'Complete',
      remaining: 0,
    });
    expect(clock(-3)).toBe('00:00');
  });
});
describe('workspace components', () => {
  it('submits labelled data and announces the active view', async () => {
    const submit = vi.fn(async (data: FormData) => {
      expect(data.get('title')).toBe('Matrix practice');
      return true;
    });
    render(
      <MemoryRouter initialEntries={['/?tab=Rooms']}>
        <Tabs labels={['Planner', 'Rooms']} />
        <Form onSubmit={submit}>
          <Field label="Title" name="title" required />
          <button type="submit">Save</button>
        </Form>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Rooms' })).toHaveAttribute('aria-current', 'page');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Matrix practice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(''));
  });
  it('renders math and displays untrusted text without creating HTML links', () => {
    const { container } = render(<RichText text={'<img src=x onerror=alert(1)> $x^2$'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
describe('isolated classroom mode', () => {
  it('requires a second participant to accept, confirm, and unlock one review', async () => {
    const maya = demoStore('maya'),
      mentor = demoStore('ishaan'),
      outsider = demoStore('nia');
    const id = await maya.rpc<string>('send_request', {
      target: 'ishaan',
      subject: 'linear',
      purpose: 'Get help',
    });
    await expect(
      maya.rpc('respond_request', { request: id, decision: 'accepted' }),
    ).rejects.toThrow('cannot be changed');
    const chat = await mentor.rpc<string>('respond_request', { request: id, decision: 'accepted' });
    await mentor.rpc('send_message', { chat, content: 'A demo explanation' });
    expect(await maya.list('messages', { where: { conversation_id: chat } })).toHaveLength(1);
    expect(await outsider.list('messages', { where: { conversation_id: chat } })).toHaveLength(0);
    expect(await maya.rpc('complete_session', { session: chat })).toBe(false);
    expect(await mentor.rpc('complete_session', { session: chat })).toBe(true);
    await maya.rpc('submit_review', { session: chat, ratings: Array(8).fill(5) });
    await expect(
      maya.rpc('submit_review', { session: chat, ratings: Array(8).fill(5) }),
    ).rejects.toThrow('already submitted');
  });
});
