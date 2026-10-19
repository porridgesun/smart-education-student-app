import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider } from '../../app/AppState'
import { MainShell } from './MainShell'

describe('main shell navigation', () => {
  beforeEach(() => localStorage.clear())

  it('keeps four main destinations available', () => {
    render(<AppStateProvider><MainShell /></AppStateProvider>)
    const nav = screen.getByRole('navigation', { name: '主要导航' })
    expect(nav).toBeInTheDocument()
    for (const label of ['首页', '知识', '测试', '我的']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('opens the available knowledge course and test map', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '知识' }))
    expect(screen.getByRole('heading', { name: 'AI 探索实验室' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '测试' }))
    expect(screen.getByRole('region', { name: '闯关地图' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主要导航' })).toBeInTheDocument()
  })

  it('opens the test tab from a grade 5-6 lesson without passing its challenge', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '知识' }))
    const chapter = screen.getByRole('button', { name: /第4章.*第一次 AI 实验/ })
    if (chapter.getAttribute('aria-expanded') === 'false') await user.click(chapter)
    await user.click(screen.getByRole('button', { name: '阅读本章内容' }))
    await user.click(screen.getByRole('button', { name: '去第 4 章测试' }))

    expect(screen.getByRole('region', { name: '闯关地图' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '测试' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: '第4章 · 第一次 AI 实验' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('闯关进度')).toHaveTextContent('2/ 9')
  })

  it('keeps the AI companion available on nested app screens', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '我的' }))
    await user.click(screen.getByRole('button', { name: '进入设置' }))

    expect(screen.getByRole('button', { name: 'AI伙伴' })).toBeInTheDocument()
  })

  it('uses only the in-map interactive companion on the elementary test tab', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '测试' }))
    const companions = screen.getAllByRole('button', { name: 'AI伙伴' })
    expect(companions).toHaveLength(1)
    expect(companions[0]).toHaveAttribute('data-companion-placement', 'test-map')
  })

  it('reviews a failed challenge in the matching Knowledge chapter', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><MainShell /></AppStateProvider>)

    await user.click(screen.getByRole('button', { name: '测试' }))
    await user.click(screen.getByRole('button', { name: '算法工具箱 · 当前关卡' }))
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    for (const answer of ['聚类', '分类', '分类', '对', '直接替所有人决定']) {
      await user.click(screen.getByRole('button', { name: answer }))
      await user.click(screen.getByRole('button', { name: /下一题|查看成绩/ }))
    }

    await user.click(screen.getByRole('button', { name: '回顾第 3 部分知识' }))

    expect(screen.getByRole('heading', { name: '第3章 · 算法工具箱' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '知识' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '测试' })).not.toHaveAttribute('aria-current')
  })
})
