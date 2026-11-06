import { describe, expect, test } from 'vitest';
import { buildExplainPrompt, classifySelection } from '@/app/reader/components/explain/prompt';

describe('classifySelection', () => {
  test('English: 3 words or fewer is a term', () => {
    expect(classifySelection('module')).toBe('term');
    expect(classifySelection('deep module')).toBe('term');
    expect(classifySelection('Interface Segregation Principle')).toBe('term');
  });

  test('English: more than 3 words is a passage', () => {
    expect(classifySelection('a deep module hides complexity')).toBe('passage');
  });

  test('CJK: 6 hanzi or fewer is a term', () => {
    expect(classifySelection('模块')).toBe('term');
    expect(classifySelection('深模块设计')).toBe('term');
  });

  test('CJK: more than 6 hanzi is a passage', () => {
    expect(classifySelection('深模块设计哲学')).toBe('passage');
    expect(classifySelection('这是一个很长的中文句子，超过六个汉字')).toBe('passage');
  });

  test('trims surrounding whitespace before classifying', () => {
    expect(classifySelection('  deep module  ')).toBe('term');
  });
});

describe('buildExplainPrompt', () => {
  test('term mode asks for a Chinese definition + usage in context', () => {
    const { system, prompt } = buildExplainPrompt({
      kind: 'term',
      text: 'deep module',
      context: 'A deep module is ...',
    });
    expect(system).toContain('word or short term');
    expect(system).toContain('"term"');
    expect(system).toContain('"def"');
    expect(system).toContain('"explain"');
    expect(prompt).toContain('A deep module is ...');
    expect(prompt).toContain('deep module');
  });

  test('passage mode asks for a Chinese translation + explanation', () => {
    const { system } = buildExplainPrompt({ kind: 'passage', text: 't', context: 'c' });
    expect(system).toContain('sentence or passage');
    expect(system).toContain('"zh"');
  });
});
