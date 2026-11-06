import { describe, expect, it } from 'vitest';
import { needsNoReferrer } from '@/utils/offlineImageInterceptor';

// صور Google Drive تُرفض على localhost عند إرسال Referer، فتُطلب بدونه
describe('Google Drive images load without a referrer', () => {
  it('targets Google image hosts only', () => {
    expect(needsNoReferrer('https://lh3.googleusercontent.com/d/abc')).toBe(true);
    expect(needsNoReferrer('https://drive.google.com/uc?id=abc')).toBe(true);
    expect(needsNoReferrer('https://docs.google.com/uc?id=abc')).toBe(true);
  });

  it('leaves other images and local paths untouched', () => {
    expect(needsNoReferrer('https://i.ibb.co/x/y.jpg')).toBe(false);
    expect(needsNoReferrer('https://atqjaiebixuzomrfwilu.supabase.co/storage/v1/object/public/uploads/a.png')).toBe(false);
    expect(needsNoReferrer('https://maps.googleapis.com/maps/api/staticmap')).toBe(false);
    expect(needsNoReferrer('/placeholder.svg')).toBe(false);
    expect(needsNoReferrer('data:image/png;base64,AAAA')).toBe(false);
    expect(needsNoReferrer('')).toBe(false);
    expect(needsNoReferrer(null)).toBe(false);
  });
});
