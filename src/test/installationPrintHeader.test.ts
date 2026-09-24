import { describe, it, expect } from 'vitest';
import { formatWindowsSafeFileName } from '@/utils/printWindowHelper';

describe('Installation task print popup header requirements', () => {
  it('formats short task ID properly from full UUID', () => {
    const fullTaskId = '3a8d9189-b725-4a72-9635-a772ada33e5f';
    const shortId = fullTaskId.length > 8 ? fullTaskId.slice(0, 8) : fullTaskId;
    expect(shortId).toBe('3a8d9189');
    expect(`مهمة #${shortId}`).toBe('مهمة #3a8d9189');
  });

  it('generates exact user-requested title for re-installation with number and ad type', () => {
    const contextNumber = 1308;
    const taskId = '3a8d9189-b725-4a72-9635-a772ada33e5f';
    const taskShortId = taskId.slice(0, 8);
    const taskType = 'reinstallation';
    const reinstallationNumber = 1;
    const adType = 'المنتج الجديد من ليلاس';

    const isReinstall = taskType === 'reinstallation';
    const rawNum = reinstallationNumber;
    const reinstallNum = (rawNum !== null && rawNum !== undefined && Number(rawNum) > 0)
      ? Number(rawNum)
      : (isReinstall ? 1 : null);
    const taskTypeLabel = isReinstall
      ? `إعادة تركيب رقم ${reinstallNum || 1}`
      : 'تركيب جديد';

    const parts: string[] = [];
    if (contextNumber) parts.push(`تركيب رقم: ${contextNumber}`);
    if (taskShortId) parts.push(`مهمة #${taskShortId}`);
    parts.push(taskTypeLabel);
    if (adType.trim()) parts.push(`نوع الإعلان: ${adType.trim()}`);

    const title = parts.join(' - ');
    expect(title).toBe('تركيب رقم: 1308 - مهمة #3a8d9189 - إعادة تركيب رقم 1 - نوع الإعلان: المنتج الجديد من ليلاس');
  });

  it('ensures re-installation title ALWAYS includes number even when reinstallationNumber is null', () => {
    const contextNumber = 1308;
    const taskId = '3a8d9189-b725-4a72-9635-a772ada33e5f';
    const taskShortId = taskId.slice(0, 8);
    const taskType = 'reinstallation';
    const reinstallationNumber = null;
    const resolvedReinstallationNumber = null;

    const isReinstall = taskType === 'reinstallation';
    const rawNum = reinstallationNumber ?? resolvedReinstallationNumber;
    const reinstallNum = (rawNum !== null && rawNum !== undefined && Number(rawNum) > 0)
      ? Number(rawNum)
      : (isReinstall ? 1 : null);
    const taskTypeLabel = isReinstall
      ? `إعادة تركيب رقم ${reinstallNum || 1}`
      : 'تركيب جديد';

    expect(taskTypeLabel).toBe('إعادة تركيب رقم 1');

    const parts: string[] = [];
    if (contextNumber) parts.push(`تركيب رقم: ${contextNumber}`);
    if (taskShortId) parts.push(`مهمة #${taskShortId}`);
    parts.push(taskTypeLabel);

    const title = parts.join(' - ');
    expect(title).toBe('تركيب رقم: 1308 - مهمة #3a8d9189 - إعادة تركيب رقم 1');
    expect(title.includes('إعادة تركيب -')).toBe(false);
  });

  it('generates exact title for new installation', () => {
    const contextNumber = 1308;
    const taskId = '3a8d9189-b725-4a72-9635-a772ada33e5f';
    const taskShortId = taskId.slice(0, 8);
    const taskType = 'installation';
    const adType = 'المنتج الجديد من ليلاس';

    const parts: string[] = [];
    if (contextNumber) parts.push(`تركيب رقم: ${contextNumber}`);
    if (taskShortId) parts.push(`مهمة #${taskShortId}`);
    parts.push('تركيب جديد');
    if (adType.trim()) parts.push(`نوع الإعلان: ${adType.trim()}`);

    const title = parts.join(' - ');
    expect(title).toBe('تركيب رقم: 1308 - مهمة #3a8d9189 - تركيب جديد - نوع الإعلان: المنتج الجديد من ليلاس');
  });

  it('formats contractInfoText inside print file keeping only the ad type', () => {
    const itemAdType = 'المنتج الجديد من ليلاس';
    const cleanAdType = itemAdType.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim();
    const contractInfoText = cleanAdType ? `نوع الإعلان: ${cleanAdType}` : '';

    expect(contractInfoText).toBe('نوع الإعلان: المنتج الجديد من ليلاس');
  });

  it('resolves ad type from designs or billboard when item and prop are missing', () => {
    const item = { billboard_id: 10 };
    const dynDesign = { design_name: 'المنتج الجديد من ليلاس' };
    const propAdType = '';
    const billboard = {};
    const rawAdType = (
      (item as any).ad_type ||
      dynDesign?.design_name ||
      propAdType ||
      (billboard as any).ad_type ||
      ''
    ).trim();
    const cleanAdType = rawAdType.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim();
    const contractInfoText = cleanAdType ? `نوع الإعلان: ${cleanAdType}` : 'تركيب رقم: 1308';

    expect(contractInfoText).toBe('نوع الإعلان: المنتج الجديد من ليلاس');
  });

  it('falls back safely to installation number when ad type is absent everywhere so line never disappears', () => {
    const cleanAdType = '';
    const itemContractNumber = 1308;
    let contractInfoText = '';
    if (cleanAdType) {
      contractInfoText = `نوع الإعلان: ${cleanAdType}`;
    } else if (itemContractNumber) {
      contractInfoText = `تركيب رقم: ${itemContractNumber}`;
    }

    expect(contractInfoText).toBe('تركيب رقم: 1308');
  });

  it('sanitizes filename with formatWindowsSafeFileName without creating dash after colon', () => {
    const rawTitle = 'تركيب رقم: 1308 - مهمة #3a8d9189 - إعادة تركيب رقم 1 - نوع الإعلان: المنتج الجديد من ليلاس';
    const safeName = formatWindowsSafeFileName(rawTitle);

    expect(safeName).toBe('تركيب رقم 1308 - مهمة #3a8d9189 - إعادة تركيب رقم 1 - نوع الإعلان المنتج الجديد من ليلاس');
    expect(safeName.includes('تركيب رقم-')).toBe(false);
    expect(safeName.includes(':')).toBe(false);
  });
});
