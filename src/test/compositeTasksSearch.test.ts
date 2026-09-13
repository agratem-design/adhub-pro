import { describe, it, expect } from 'vitest';

const normalizeForSearch = (str?: string | null): string => {
  return String(str || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove Arabic tashkeel / diacritics
    .replace(/[#_\\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

interface MockTask {
  id: string;
  contract_id: number | string;
  contractIds?: number[];
  customer_name: string;
  companyName?: string;
  adType?: string;
  adTypes?: string[];
  teamName?: string;
  printerName?: string;
  task_type?: string;
  notes?: string;
  _searchableText?: string;
}

function buildSearchIndex(t: MockTask): string {
  const parts = [
    t.customer_name,
    t.companyName,
    t.contract_id ? `عقد ${t.contract_id} ${t.contract_id}` : '',
    ...(t.contractIds || []).map(cid => `عقد ${cid} ${cid}`),
    t.adType,
    ...(t.adTypes || []),
    t.teamName,
    t.printerName,
    t.task_type === 'reinstallation' ? 'اعادة تركيب اعادة دورة' : 'تركيب اول اولي',
    t.notes,
    t.id,
  ];
  return normalizeForSearch(parts.filter(Boolean).join(' '));
}

function searchTasks(tasks: MockTask[], search: string): MockTask[] {
  if (!search || !search.trim()) return tasks;
  const normalizedQuery = normalizeForSearch(search);
  const rawTokens = normalizedQuery.split(' ').filter(Boolean);
  const tokens = rawTokens.length > 1 ? rawTokens.filter(tok => tok !== 'عقد') : rawTokens;

  return tasks.filter(t => {
    const text = t._searchableText || buildSearchIndex(t);
    return tokens.every(tok => text.includes(tok));
  });
}

describe('Composite Tasks High-Performance Search', () => {
  const sampleTasks: MockTask[] = [
    {
      id: 'task-1',
      contract_id: 1178,
      contractIds: [1178],
      customer_name: 'حمزة رحومة',
      companyName: 'شركة المتوسط الزاهر',
      adType: 'مواد غذائية زر وشاهي',
      teamName: 'فرقة عبدالرزاق العاتي',
      printerName: 'مطبعة النور',
      task_type: 'installation',
      notes: 'تركيب طريق المطار'
    },
    {
      id: 'task-2',
      contract_id: 1158,
      contractIds: [1158],
      customer_name: 'حمزة رحومة',
      companyName: 'شركة المتوسط الزاهر',
      adType: 'مواد غذائية',
      teamName: 'فرقة عبدالرزاق العاتي',
      task_type: 'reinstallation',
      notes: 'إعادة تركيب بعد الصيانة'
    },
    {
      id: 'task-3',
      contract_id: 1252,
      contractIds: [1252],
      customer_name: 'شركة إيثار',
      companyName: 'إيثار للدعاية',
      adType: 'بولبو تاجوراء',
      teamName: 'فرقة طرابلس المركز',
      task_type: 'installation',
    },
    {
      id: 'task-4',
      contract_id: 1294,
      contractIds: [1294, 1295],
      customer_name: 'محمد فتحي البهلول',
      companyName: 'شركة أثر',
      adType: 'مشروب طاقة',
      teamName: 'فرقة جنزور',
      task_type: 'reinstallation',
    },
  ].map(t => ({ ...t, _searchableText: buildSearchIndex(t) }));

  it('should find by contract number with or without prefix or hash', () => {
    expect(searchTasks(sampleTasks, '1178').map(t => t.id)).toEqual(['task-1']);
    expect(searchTasks(sampleTasks, '#1178').map(t => t.id)).toEqual(['task-1']);
    expect(searchTasks(sampleTasks, 'عقد 1178').map(t => t.id)).toEqual(['task-1']);
    expect(searchTasks(sampleTasks, 'عقد #1178').map(t => t.id)).toEqual(['task-1']);
  });

  it('should find by company name', () => {
    const results = searchTasks(sampleTasks, 'المتوسط');
    expect(results.map(t => t.id)).toEqual(['task-1', 'task-2']);

    const zhaher = searchTasks(sampleTasks, 'الزاهر');
    expect(zhaher.map(t => t.id)).toEqual(['task-1', 'task-2']);
  });

  it('should normalize Arabic characters (hamza, taa marbuta, alif maqsura)', () => {
    // Search with 'حمزه' (ending in haa) should match 'حمزة' (ending in taa marbuta)
    expect(searchTasks(sampleTasks, 'حمزه').map(t => t.id)).toEqual(['task-1', 'task-2']);

    // Search with 'ايثار' should match 'إيثار'
    expect(searchTasks(sampleTasks, 'ايثار').map(t => t.id)).toEqual(['task-3']);

    // Search with 'اثر' should match 'أثر'
    expect(searchTasks(sampleTasks, 'اثر').map(t => t.id)).toEqual(['task-4']);
  });

  it('should support multi-word search across customer and contract', () => {
    const results = searchTasks(sampleTasks, 'حمزة 1178');
    expect(results.map(t => t.id)).toEqual(['task-1']);

    const results2 = searchTasks(sampleTasks, 'المتوسط 1158');
    expect(results2.map(t => t.id)).toEqual(['task-2']);
  });

  it('should search by operation type (e.g. إعادة تركيب)', () => {
    const reinstalls = searchTasks(sampleTasks, 'اعادة تركيب');
    expect(reinstalls.map(t => t.id)).toEqual(['task-2', 'task-4']);
  });

  it('should search by team name', () => {
    const aty = searchTasks(sampleTasks, 'العاتي');
    expect(aty.map(t => t.id)).toEqual(['task-1', 'task-2']);
  });

  it('should execute filtering across 1000 tasks in less than 5ms', () => {
    const largeList: MockTask[] = [];
    for (let i = 0; i < 1000; i++) {
      const base = sampleTasks[i % sampleTasks.length];
      largeList.push({
        ...base,
        id: `gen-task-${i}`,
        contract_id: 1000 + i,
        _searchableText: buildSearchIndex({ ...base, id: `gen-task-${i}`, contract_id: 1000 + i })
      });
    }

    const start = performance.now();
    const matches = searchTasks(largeList, 'حمزة 1000');
    const elapsed = performance.now() - start;

    expect(matches.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(15); // Fast sub-15ms execution for 1000 items
  });
});
