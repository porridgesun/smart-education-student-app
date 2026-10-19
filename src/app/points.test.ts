import { describe, expect, it } from 'vitest'
import { getPartIdsForBand, makeCoursePartId } from './learning'
import { getCourseForBand } from '../features/knowledge/courseCatalog'
import {
  applyTransactionOnce,
  buildProgressRewardTransactions,
  getPointsBalance,
  getPointsSummary,
} from './points'

describe('points and progress rewards', () => {
  const courses = [
    ['grade1-2', 'qmx-1', 8],
    ['grade3-4', 'cxd-1', 6],
    ['grade5-6', 'ael-1', 9],
  ] as const

  it.each(courses)('awards only the first chapter ledger for %s', (band, partId, count) => {
    const partIds = getPartIdsForBand(band)
    expect(partIds).toHaveLength(count)
    expect(partIds).toEqual(getCourseForBand(band).parts.map((part) => part.id))
    const before = { knowledgeCompleted: [], testsPassed: [] }
    const after = { knowledgeCompleted: [partId], testsPassed: [partId] }
    const txs = buildProgressRewardTransactions(before, after, band, partIds, '2026-10-19')
    expect(txs.map((tx) => [tx.eventId, tx.amount])).toEqual([
      [`knowledge:${partId}`, 30],
      [`test:${partId}`, 50],
      [`medal:${partId}`, 20],
    ])
    expect(buildProgressRewardTransactions(after, after, band, partIds, '2026-10-19')).toEqual([])
  })

  it.each(courses)('awards the finale once upon the last real chapter for %s', (band, _, count) => {
    const partIds = getPartIdsForBand(band)
    expect(partIds).toHaveLength(count)
    expect(partIds).toEqual(getCourseForBand(band).parts.map((part) => part.id))
    const finalPartId = partIds[partIds.length - 1]
    const completedBefore = partIds.slice(0, -1)
    const before = { knowledgeCompleted: completedBefore, testsPassed: completedBefore }
    const after = { knowledgeCompleted: partIds, testsPassed: partIds }
    const txs = buildProgressRewardTransactions(before, after, band, partIds, '2026-10-19')
    expect(txs.map((tx) => [tx.eventId, tx.amount])).toEqual([
      [`knowledge:${finalPartId}`, 30],
      [`test:${finalPartId}`, 50],
      [`medal:${finalPartId}`, 20],
      [`band:${band}`, 100],
    ])
    expect(buildProgressRewardTransactions(after, after, band, partIds, '2026-10-19')).toEqual([])
  })

  it('keeps balance and totals mathematically consistent', () => {
    const records = [
      { id: 'a', eventId: 'starter', kind: 'starter' as const, title: '启航积分', amount: 2000, occurredAt: '2026-10-12' },
      { id: 'b', eventId: 'purchase:yunduo', kind: 'purchase' as const, title: '购买云朵', amount: -360, occurredAt: '2026-10-12' },
    ]
    expect(getPointsBalance(records)).toBe(1640)
    expect(getPointsSummary(records)).toEqual({ earned: 2000, spent: 360, balance: 1640 })
  })

  it('does not append the same event twice', () => {
    const initial = { transactions: [], processedRewardIds: [] as string[] }
    const tx = { id: 'r1', eventId: 'knowledge:ael-1', kind: 'knowledge' as const, title: '完成知识', amount: 30, occurredAt: '2026-10-12' }
    const once = applyTransactionOnce(initial, tx)
    expect(applyTransactionOnce(once, tx)).toEqual(once)
  })

  it('awards 30, 50, 20 and the 100-point finale exactly once', () => {
    const partIds = [makeCoursePartId('ael', 1), makeCoursePartId('ael', 2)]
    const before = { knowledgeCompleted: [partIds[0]], testsPassed: [] }
    const after = { knowledgeCompleted: partIds, testsPassed: partIds }
    const txs = buildProgressRewardTransactions(before, after, 'grade5-6', partIds, '2026-10-12')
    expect(txs.map((tx) => tx.amount)).toEqual([50, 20, 30, 50, 20, 100])
    expect(new Set(txs.map((tx) => tx.eventId)).size).toBe(txs.length)
  })
})
