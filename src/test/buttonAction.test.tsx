import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@/components/ui/button';

describe('window action buttons', () => {
  it('does not submit a surrounding form unless submission is explicit', () => {
    const html = renderToStaticMarkup(<form><Button>طباعة</Button><Button type="submit">حفظ</Button></form>);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const buttons = doc.querySelectorAll('button');
    expect(buttons[0].type).toBe('button');
    expect(buttons[1].type).toBe('submit');
  });
});
