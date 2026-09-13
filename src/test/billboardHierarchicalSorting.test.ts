import { describe, it, expect } from 'vitest';
import {
  sortBillboardsStandardSync,
  getSizeRankFromMap,
  getMuniRankFromMap,
  getLevelRank,
  normalizeArabicText,
  parseSizeArea
} from '@/lib/billboardSorter';

describe('Hierarchical Billboard Sorting', () => {
  const mockSizes = [
    { name: '13x5', sort_order: 1 },
    { name: '12x4', sort_order: 2 },
    { name: '10x4', sort_order: 3 },
    { name: '3X8-T', sort_order: 4 },
    { name: '8x3', sort_order: 5 },
    { name: '6x3', sort_order: 6 },
    { name: '4x3', sort_order: 7 },
  ];

  const mockMunicipalities = [
    { name: 'طرابلس المركز', code: 'TC', sort_order: 1 },
    { name: 'بوسليم', code: 'BS', sort_order: 2 },
    { name: 'سوق الجمعة', code: 'SJ', sort_order: 3 },
    { name: 'عين زارة', code: 'AZ', sort_order: 4 },
    { name: 'حي الأندلس', code: 'HA', sort_order: 5 },
    { name: 'جنزور', code: 'JZ', sort_order: 6 },
    { name: 'تاجوراء', code: 'TJ', sort_order: 7 },
    { name: 'الزاوية', code: 'ZW', sort_order: 8 },
    { name: 'مصراتة', code: 'MS', sort_order: 9 },
    { name: 'زليتن', code: 'ZL', sort_order: 10 },
    { name: 'الخمس', code: 'KS', sort_order: 11 },
    { name: 'قصر الاخيار', code: 'QK', sort_order: 19 },
  ];

  const mockLevels = [
    { level_code: 'S', level_name: 'المستوى المميز', sort_order: 1 },
    { level_code: 'A', level_name: 'المستوى الأول', sort_order: 2 },
    { level_code: 'B', level_name: 'المستوى الثاني', sort_order: 4 },
    { level_code: 'C', level_name: 'عادي', sort_order: 5 },
  ];

  it('should sort primarily by Size according to sort_order', () => {
    const billboards = [
      { id: 1, Size: '4x3', Municipality: 'طرابلس المركز', Level: 'A' },
      { id: 2, Size: '13x5', Municipality: 'طرابلس المركز', Level: 'A' },
      { id: 3, Size: '8x3', Municipality: 'طرابلس المركز', Level: 'A' },
      { id: 4, Size: '12x4', Municipality: 'طرابلس المركز', Level: 'A' },
    ];

    const sorted = sortBillboardsStandardSync(billboards, mockSizes, mockMunicipalities, mockLevels);
    expect(sorted.map(b => b.Size)).toEqual(['13x5', '12x4', '8x3', '4x3']);
  });

  it('should sort secondarily by Municipality/City within the same size', () => {
    const billboards = [
      { id: 1, Size: '8x3', Municipality: 'الزاوية', Level: 'A' },
      { id: 2, Size: '8x3', Municipality: 'بوسليم', Level: 'A' },
      { id: 3, Size: '8x3', Municipality: 'طرابلس المركز', Level: 'A' },
      { id: 4, Size: '8x3', Municipality: 'عين زارة', Level: 'A' },
    ];

    const sorted = sortBillboardsStandardSync(billboards, mockSizes, mockMunicipalities, mockLevels);
    expect(sorted.map(b => b.Municipality)).toEqual([
      'طرابلس المركز',
      'بوسليم',
      'عين زارة',
      'الزاوية'
    ]);
  });

  it('should sort tertiarily by Level within the same size and municipality', () => {
    const billboards = [
      { id: 1, Size: '12x4', Municipality: 'جنزور', Level: 'C' },
      { id: 2, Size: '12x4', Municipality: 'جنزور', Level: 'S' },
      { id: 3, Size: '12x4', Municipality: 'جنزور', Level: 'B' },
      { id: 4, Size: '12x4', Municipality: 'جنزور', Level: 'A' },
    ];

    const sorted = sortBillboardsStandardSync(billboards, mockSizes, mockMunicipalities, mockLevels);
    expect(sorted.map(b => b.Level)).toEqual(['S', 'A', 'B', 'C']);
  });

  it('should handle Libyan municipality aliases and normalization', () => {
    const billboards = [
      { id: 1, Size: '8x3', Municipality: 'قصر خيار', Level: 'A' }, // alias of قصر الاخيار (19)
      { id: 2, Size: '8x3', Municipality: 'طرابلس', Level: 'A' },    // alias of طرابلس المركز (1)
      { id: 3, Size: '8x3', Municipality: 'عين زاره', Level: 'A' },  // normalized to عين زارة (4)
    ];

    const sorted = sortBillboardsStandardSync(billboards, mockSizes, mockMunicipalities, mockLevels);
    expect(sorted.map(b => b.Municipality)).toEqual([
      'طرابلس',
      'عين زاره',
      'قصر خيار'
    ]);
  });

  it('should handle size normalization like 3X8-T, 3x8-t, 12×4, 8X3', () => {
    const billboards = [
      { id: 1, Size: '8X3', Municipality: 'طرابلس المركز', Level: 'A' },
      { id: 2, Size: '12×4', Municipality: 'طرابلس المركز', Level: 'A' },
      { id: 3, Size: '3x8-t', Municipality: 'طرابلس المركز', Level: 'A' },
    ];

    const sorted = sortBillboardsStandardSync(billboards, mockSizes, mockMunicipalities, mockLevels);
    expect(sorted.map(b => b.Size)).toEqual(['12×4', '3x8-t', '8X3']);
  });

  it('should use area descending as fallback for sizes not in the database table', () => {
    const billboards = [
      { id: 1, Size: '2x2', Municipality: 'طرابلس المركز', Level: 'A' },  // 4m²
      { id: 2, Size: '20x5', Municipality: 'طرابلس المركز', Level: 'A' }, // 100m²
      { id: 3, Size: '15x4', Municipality: 'طرابلس المركز', Level: 'A' }, // 60m²
    ];

    const sorted = sortBillboardsStandardSync(billboards, mockSizes, mockMunicipalities, mockLevels);
    expect(sorted.map(b => b.Size)).toEqual(['20x5', '15x4', '2x2']);
  });

  it('should deterministically break ties by billboard ID and Name', () => {
    const billboards = [
      { id: 200, name: 'ب لوحة', Size: '8x3', Municipality: 'جنزور', Level: 'A' },
      { id: 100, name: 'أ لوحة', Size: '8x3', Municipality: 'جنزور', Level: 'A' },
    ];

    const sorted = sortBillboardsStandardSync(billboards, mockSizes, mockMunicipalities, mockLevels);
    expect(sorted.map(b => b.id)).toEqual([100, 200]);
  });
});
