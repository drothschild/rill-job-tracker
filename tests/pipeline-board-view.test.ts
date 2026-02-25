import { describe, it, expect } from 'vitest';
import { pipelineBoardView } from '../src/views/pipeline/board';
import type { Stage } from '../src/db/queries';

const stages: Stage[] = [
  { id: 1, name: 'Applied', display_order: 1 },
  { id: 2, name: 'Phone Screen', display_order: 2 },
];

describe('pipelineBoardView drag-and-drop HTML', () => {
  it('sets dataTransfer data in dragstart for Firefox compatibility', () => {
    const html = pipelineBoardView(stages, []);
    expect(html).toContain('dataTransfer.setData');
  });

  it('registers Alpine component when Alpine is already loaded (HTMX swap scenario)', () => {
    const html = pipelineBoardView(stages, []);
    // Must handle the case where alpine:init has already fired
    expect(html).toContain("typeof Alpine !== 'undefined'");
  });

  it('calls Alpine.initTree to reinitialize Alpine on HTMX-swapped content', () => {
    const html = pipelineBoardView(stages, []);
    expect(html).toContain('Alpine.initTree');
  });

  it('uses URLSearchParams not FormData for fetch so Express urlencoded parser can read the body', () => {
    const html = pipelineBoardView(stages, []);
    expect(html).not.toContain('new FormData()');
    expect(html).toContain('URLSearchParams');
  });
});
