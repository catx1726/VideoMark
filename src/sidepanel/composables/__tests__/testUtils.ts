import type { Mark } from '~/logic/storage'
import type { TagTree } from '~/logic/tagTree'

export interface TestMark {
  id: string
  text?: string
  html?: string
  note?: string
  url?: string
  title?: string
  contextTitle?: string
  platform?: string
  createdAt?: number
  tags?: string[]
}

export function buildSampleTree(): TagTree {
  const markA: TestMark = {
    id: 'a',
    text: 'hello world',
    html: '<mark>hello world</mark>',
    url: 'https://example.com/page-a',
    title: 'Page A',
    createdAt: 1,
    tags: ['tag1'],
  }

  const markB: TestMark = {
    id: 'b',
    text: 'another note',
    html: '<mark>another note</mark>',
    url: 'https://example.com/page-b',
    title: 'Page B',
    createdAt: 2,
    tags: ['tag2'],
  }

  return {
    tag1: { tagName: 'Tag One', totalMarks: 1, pages: {
      'https://example.com/page-a': { pageTitle: 'Page A', groups: [{
        title: 'Group A',
        level: 7,
        selector: 'body',
        marks: [markA as Mark],
        count: 1,
        order: 0,
      }], totalMarks: 1 },
    } },
    tag2: { tagName: 'Tag Two', totalMarks: 1, pages: {
      'https://example.com/page-b': { pageTitle: 'Page B', groups: [{
        title: 'Group B',
        level: 7,
        selector: 'body',
        marks: [markB as Mark],
        count: 1,
        order: 0,
      }], totalMarks: 1 },
    } },
  }
}

export function buildSampleTreeWithMultipleMarks(): TagTree {
  const markA: TestMark = {
    id: 'a',
    text: 'hello world',
    createdAt: 1,
  }

  const markC: TestMark = {
    id: 'c',
    text: 'context here',
    createdAt: 3,
  }

  return {
    tag1: { tagName: 'Tag One', totalMarks: 2, pages: {
      'https://example.com/page-a': { pageTitle: 'Page A', groups: [{
        title: 'Group A',
        level: 7,
        selector: 'body',
        marks: [markA as Mark, markC as Mark],
        count: 2,
        order: 0,
      }], totalMarks: 2 },
    } },
  }
}

export function buildSampleTreeWithVideoMarks(): TagTree {
  const markA: TestMark = {
    id: 'a',
    text: '12:34',
    note: '精彩时刻',
    platform: 'youtube',
    url: 'https://example.com/video-a',
    title: 'Video A',
    createdAt: 1,
    tags: ['tag1'],
  }

  const markB: TestMark = {
    id: 'b',
    text: '05:00',
    note: '另一个片段',
    platform: 'bilibili',
    url: 'https://example.com/video-b',
    title: 'Video B',
    createdAt: 2,
    tags: ['tag2'],
  }

  return {
    tag1: { tagName: 'Tag One', totalMarks: 1, pages: {
      'https://example.com/video-a': { pageTitle: 'Video A', groups: [{
        title: '未分类标记',
        level: 7,
        selector: 'body',
        marks: [markA as Mark],
        count: 1,
        order: 0,
      }], totalMarks: 1 },
    } },
    tag2: { tagName: 'Tag Two', totalMarks: 1, pages: {
      'https://example.com/video-b': { pageTitle: 'Video B', groups: [{
        title: '未分类标记',
        level: 7,
        selector: 'body',
        marks: [markB as Mark],
        count: 1,
        order: 0,
      }], totalMarks: 1 },
    } },
  }
}
