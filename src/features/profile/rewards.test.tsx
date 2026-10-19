import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { getPartIdsForBand, type GradeBand, type PrimaryGrade } from '../../app/learning'
import { createDefaultState } from '../../app/model'
import type { PointTransaction } from '../../app/points'
import { MedalsPage } from './MedalsPage'
import { PointsPage } from './PointsPage'

describe('profile rewards', () => {
  beforeEach(() => localStorage.clear())

  const courses = [
    ['grade1', 'grade1-2', 'qmx-1', '启明星岛', '好奇宝石', '启明星守护者'],
    ['grade3', 'grade3-4', 'cxd-1', 'AI 超能力图鉴', '全景徽章', '创想大陆之星'],
    ['grade5', 'grade5-6', 'ael-1', 'AI 系统拆解站', '拆解徽章', 'AI 探索小导师'],
  ] as const satisfies readonly (readonly [PrimaryGrade, GradeBand, string, string, string, string])[]

  it.each(courses)('shows the first chapter medal and transaction titles for %s', (grade, band, partId, title, medalName) => {
    const state = createDefaultState()
    state.grade = grade
    state.learningProgress['grade5-6'] = { knowledgeCompleted: [], testsPassed: [] }
    state.learningProgress[band] = { knowledgeCompleted: [partId], testsPassed: [partId] }
    state.processedRewardIds = state.transactions.map((record) => record.eventId)
    const records: PointTransaction[] = [
      { id: `knowledge:${partId}`, eventId: `knowledge:${partId}`, kind: 'knowledge', title: `完成知识：${title}`, amount: 30, occurredAt: '2026-10-19' },
      { id: `test:${partId}`, eventId: `test:${partId}`, kind: 'test', title: `通过测试：${title}`, amount: 50, occurredAt: '2026-10-19' },
      { id: `medal:${partId}`, eventId: `medal:${partId}`, kind: 'medal', title: `点亮课程徽章：${partId}`, amount: 20, occurredAt: '2026-10-19' },
    ]
    state.transactions.push(...records)
    state.processedRewardIds.push(...records.map((record) => record.eventId))
    localStorage.setItem('student-app-state', JSON.stringify(state))

    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /><PointsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText(medalName).closest('li')).toHaveTextContent('已点亮')
    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('2,100')
    expect(screen.getByText(`完成知识：${title}`)).toBeInTheDocument()
    expect(screen.getByText(`通过测试：${title}`)).toBeInTheDocument()
  })

  it('derives the default first two medals and explains the third', () => {
    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('已获得 2 枚课程徽章')).toBeInTheDocument()
    expect(screen.getByText('算法徽章').closest('li')).toHaveTextContent('知识已完成，测试待通过')
    expect(screen.getByRole('heading', { name: '成长勋章' })).toBeInTheDocument()
  })

  it('keeps the finale separate and locked until every course part is complete', () => {
    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByRole('heading', { name: '终章勋章' })).toBeInTheDocument()
    expect(screen.getByText('AI 探索小导师').closest('li')).toHaveTextContent('完成全部课程知识与测试后点亮')
  })

  it.each(courses)('lights the correct finale only after every part is complete for %s', (grade, band, _, __, ___, finaleName) => {
    const state = createDefaultState()
    const allPartIds = getPartIdsForBand(band)
    state.grade = grade
    state.learningProgress[band] = {
      knowledgeCompleted: [...allPartIds],
      testsPassed: [...allPartIds],
    }
    localStorage.setItem('student-app-state', JSON.stringify(state))

    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText(finaleName).closest('li')).toHaveTextContent('已点亮')
  })

  it.each(courses)('keeps the finale locked with the last test missing for %s', (grade, band, _, __, ___, finaleName) => {
    const state = createDefaultState()
    const allPartIds = getPartIdsForBand(band)
    state.grade = grade
    state.learningProgress[band] = {
      knowledgeCompleted: [...allPartIds],
      testsPassed: allPartIds.slice(0, -1),
    }
    localStorage.setItem('student-app-state', JSON.stringify(state))

    render(<AppStateProvider><MedalsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText(finaleName).closest('li')).toHaveTextContent('完成全部课程知识与测试后点亮')
  })

  it('renders totals and records from the same 2000-point ledger', () => {
    render(<AppStateProvider><PointsPage onBack={vi.fn()} /></AppStateProvider>)

    expect(screen.getByText('当前积分').parentElement).toHaveTextContent('2,000')
    expect(screen.getByText('累计获得').parentElement).toHaveTextContent('+2,000')
    expect(screen.getByText('累计消耗').parentElement).toHaveTextContent('-0')
    expect(screen.getByText('成长体验账号启航积分')).toBeInTheDocument()
    expect(screen.queryByText(/星空精灵/)).not.toBeInTheDocument()
  })
})
