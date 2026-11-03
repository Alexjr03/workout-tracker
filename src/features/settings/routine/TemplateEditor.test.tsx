import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { resetDb } from '../../../test/db';
import { TemplateEditor } from './TemplateEditor';

beforeEach(async () => {
  await resetDb();
});

function renderEditor(templateId: string) {
  return render(
    <MemoryRouter initialEntries={[`/settings/sessions/${templateId}`]}>
      <Routes>
        <Route path="/settings/sessions/:templateId" element={<TemplateEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function upperA() {
  const t = (await db.routine.get('routine'))?.sessions['upper-a'];
  if (!t || !('exercises' in t)) throw new Error('fixture');
  return t.exercises;
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Exercises' }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('.template-row-name')?.textContent);

describe('TemplateEditor', () => {
  it('lists the exercises with their sets and reps', async () => {
    renderEditor('upper-a');
    expect(await screen.findByRole('heading', { name: 'Upper A' })).toBeInTheDocument();
    expect(rows()).toEqual([
      'Bench press',
      'Chest-supported or machine row',
      'Lat pulldown',
      'Seated dumbbell shoulder press',
      'Lateral raise',
      'Triceps pushdown',
    ]);
    expect(screen.getAllByText('3 × 8–10')).toHaveLength(3);
  });

  it('edits sets and reps', async () => {
    renderEditor('upper-a');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Bench press' }));
    const editor = screen.getByRole('group', { name: 'Bench press' });
    await userEvent.click(within(editor).getByRole('button', { name: 'Increase Sets' }));
    await vi.waitFor(async () => expect((await upperA())[0]?.sets).toBe(4));
    expect(await screen.findByText('4 × 8–10')).toBeInTheDocument();
  });

  it('shows an error when rep min would pass rep max', async () => {
    renderEditor('upper-a');
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Bench press' }));
    const editor = screen.getByRole('group', { name: 'Bench press' });
    const min = within(editor).getByRole('textbox', { name: 'Rep min' });
    await userEvent.clear(min);
    await userEvent.type(min, '12');
    await userEvent.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Rep min can't be more than rep max.",
    );
    expect((await upperA())[0]?.repMin).toBe(8);
  });

  it('moves and removes exercises', async () => {
    renderEditor('upper-a');
    await userEvent.click(await screen.findByRole('button', { name: 'Move Bench press down' }));
    await vi.waitFor(() =>
      expect(rows().slice(0, 2)).toEqual(['Chest-supported or machine row', 'Bench press']),
    );
    expect(
      screen.getByRole('button', { name: 'Move Chest-supported or machine row up' }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Triceps pushdown' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove from Upper A' }));
    await vi.waitFor(() => expect(rows()).not.toContain('Triceps pushdown'));
  });

  it('adds an exercise from the catalog', async () => {
    renderEditor('upper-a');
    const add = await screen.findByRole('combobox', { name: 'Add exercise' });
    expect(within(add).queryByRole('option', { name: 'Bench press' })).not.toBeInTheDocument();
    await userEvent.selectOptions(add, 'Face pull');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await vi.waitFor(() => expect(rows().at(-1)).toBe('Face pull'));
    expect((await upperA()).at(-1)).toMatchObject({
      id: 'face-pull',
      sets: 3,
      repMin: 8,
      repMax: 12,
    });
  });

  it('says so for cardio or unknown sessions', async () => {
    const view = renderEditor('cardio');
    expect(
      await screen.findByText('Cardio sessions have no exercises to edit.'),
    ).toBeInTheDocument();
    view.unmount();
    renderEditor('nope');
    expect(await screen.findByText('Session not found.')).toBeInTheDocument();
  });
});
