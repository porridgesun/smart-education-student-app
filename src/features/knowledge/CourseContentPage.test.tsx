import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppStateProvider, useAppState } from '../../app/AppState'
import { CourseContentPage } from './CourseContentPage'

function ProgressObserver() {
  const { state } = useAppState()

  return (
    <output aria-label="all knowledge progress">
      {JSON.stringify({
        'grade1-2': state.learningProgress['grade1-2'].knowledgeCompleted,
        'grade3-4': state.learningProgress['grade3-4'].knowledgeCompleted,
        'grade5-6': state.learningProgress['grade5-6'].knowledgeCompleted,
      })}
    </output>
  )
}

describe('CourseContentPage', () => {
  afterEach(() => vi.useRealTimers())

  it('embeds the 4-6 grade Bilibili lesson video inside the reading page', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="cxd" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    expect(screen.getByTitle('视频 1-1《AI 在身边：无处不在的智能应用》')).toHaveAttribute(
      'src',
      'https://player.bilibili.com/player.html?bvid=BV12dwVzuEmF&page=1&high_quality=1&danmaku=0&autoplay=0',
    )
  })

  it('keeps an accessible original-platform link beside each embedded lesson video', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="cxd" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    expect(screen.getByRole('link', { name: '在原平台打开视频 1-1《AI 在身边：无处不在的智能应用》' })).toHaveAttribute(
      'href',
      'https://www.bilibili.com/video/BV12dwVzuEmF',
    )
  })

  it('shows only one original-platform action for each embedded video', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="cxd" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    const firstVideoLinks = screen.getAllByRole('link').filter(
      (link) => link.getAttribute('href') === 'https://www.bilibili.com/video/BV12dwVzuEmF',
    )
    expect(firstVideoLinks).toHaveLength(1)
  })

  it('shows a clear fallback when an embedded lesson video cannot load', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="cxd" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    fireEvent.error(screen.getByTitle('视频 1-1《AI 在身边：无处不在的智能应用》'))

    expect(screen.getByRole('status')).toHaveTextContent('视频暂时无法在页内播放')
    expect(screen.getByRole('link', { name: '在原平台打开视频 1-1《AI 在身边：无处不在的智能应用》' })).toBeInTheDocument()
  })

  it('keeps a helpful cover, then falls back when the player never becomes ready', () => {
    vi.useFakeTimers()
    render(
      <AppStateProvider>
        <CourseContentPage courseId="cxd" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    const videoCard = screen.getByRole('region', { name: '视频 1-1《AI 在身边：无处不在的智能应用》' })
    expect(within(videoCard).getByText('视频正在准备中')).toBeInTheDocument()
    expect(within(videoCard).getByText(/打不开也没关系/)).toBeInTheDocument()
    expect(within(videoCard).getByRole('link', { name: /在原平台打开/ })).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(8_000))

    expect(within(videoCard).getByRole('status')).toHaveTextContent('视频暂时无法在页内播放')
    expect(within(videoCard).getByText(/原平台/)).toBeInTheDocument()
  })

  it('reveals the inline player after its document loads', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="cxd" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    const player = screen.getByTitle('视频 1-1《AI 在身边：无处不在的智能应用》')
    const videoCard = screen.getByRole('region', { name: '视频 1-1《AI 在身边：无处不在的智能应用》' })
    expect(player).toHaveAttribute('data-player-state', 'loading')
    fireEvent.load(player)
    expect(player).toHaveAttribute('data-player-state', 'ready')
    expect(within(videoCard).queryByText('视频正在准备中')).not.toBeInTheDocument()
  })

  it('uses the illustrated page with dialogue for the primary comic', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="qmx" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    expect(screen.getByRole('img', { name: '飞船内' })).toHaveAttribute(
      'src',
      '/courses/qmx/with-text/page-05.png',
    )
  })

  it('preserves the full widescreen comic page instead of cropping it', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="qmx" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    const comicPage = screen.getByRole('img', { name: '飞船内' })
    expect(comicPage).toHaveAttribute('width', '1280')
    expect(comicPage).toHaveAttribute('height', '720')
    expect(comicPage).toHaveStyle({ aspectRatio: '16 / 9', objectFit: 'contain' })
  })

  it('renders the grade 5-6 primary chapter structure without the retired HTML surface', () => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId="ael" chapterNum={1} onBack={() => undefined} />
      </AppStateProvider>,
    )

    expect(screen.getByRole('heading', { name: '第1章 · AI 系统拆解站' })).toBeInTheDocument()
    expect(screen.getByText(/校园里有两片长得很像的叶子/)).toBeInTheDocument()
    expect(screen.getByText(/识别建议不能用于判断植物能否食用/)).toBeInTheDocument()
  })

  it('renders the full primary-school lab sequence for chapter four', () => {
    render(<AppStateProvider><CourseContentPage courseId="ael" chapterNum={4} onBack={vi.fn()} /></AppStateProvider>)

    const content = document.querySelector('.grade56-content')!
    expect(within(content as HTMLElement).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      '生活问题', '图解知识', '动手实验', '安全提醒', '小挑战', '选看视频',
    ])
    expect(screen.getByText('教室物品识别实验路线')).toBeInTheDocument()
    expect(screen.getByText(/两轮各答对几次/)).toBeInTheDocument()
    expect(screen.getByTitle('用 AI 识别水果：观察采集、训练、识别流程')).toHaveAttribute(
      'src', expect.stringContaining('bvid=BV1Jau7zoEf5'),
    )
    expect(screen.getByTitle('用 AI 识别水果：观察采集、训练、识别流程')).toHaveAttribute(
      'src', expect.stringContaining('autoplay=0'),
    )
    expect(screen.getByRole('link', { name: '在视频平台打开' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: '在视频平台打开' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('button', { name: '去第 4 章测试' })).toBeInTheDocument()
  })

  it('does not require a video for the safety chapter', async () => {
    const user = userEvent.setup()
    render(<AppStateProvider><CourseContentPage courseId="ael" chapterNum={8} onBack={vi.fn()} /></AppStateProvider>)
    expect(screen.queryByRole('heading', { name: '选看视频' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完成本部分知识' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去第 8 章测试' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '完成本部分知识' }))
    expect(screen.getByRole('status')).toHaveTextContent('获得 30 积分')
  })

  it('renders all six project canvas steps in chapter nine', () => {
    render(<AppStateProvider><CourseContentPage courseId="ael" chapterNum={9} onBack={vi.fn()} /></AppStateProvider>)
    expect(screen.getByText('我的 AI 小项目六格画布')).toBeInTheDocument()
    const visual = screen.getByRole('region', { name: '图解知识' })
    expect(within(visual).getAllByRole('term').map((term) => term.textContent)).toEqual([
      '目标', '输入', '输出', '测试', '风险', '改进',
    ])
  })

  it('offers test navigation without marking the test passed', async () => {
    const user = userEvent.setup()
    const onStartTest = vi.fn()
    render(
      <AppStateProvider>
        <CourseContentPage courseId="ael" chapterNum={4} onBack={vi.fn()} onStartTest={onStartTest} />
        <ProgressObserver />
      </AppStateProvider>,
    )
    await user.click(screen.getByRole('button', { name: '去第 4 章测试' }))
    expect(onStartTest).toHaveBeenCalledWith('ael', 4)
    expect(screen.getByLabelText('all knowledge progress')).toHaveTextContent(
      '{"grade1-2":[],"grade3-4":[],"grade5-6":["ael-1","ael-2","ael-3"]}',
    )
  })

  it.each([
    ['cxd', '视频 1-1《AI 在身边：无处不在的智能应用》'],
    ['qmx', '飞船内'],
  ])('keeps the non-active %s course as a read-only preview', (courseId, previewName) => {
    render(
      <AppStateProvider>
        <CourseContentPage courseId={courseId} chapterNum={1} onBack={() => undefined} />
        <ProgressObserver />
      </AppStateProvider>,
    )

    const preview = courseId === 'cxd'
      ? screen.getByTitle(previewName)
      : screen.getByRole('img', { name: previewName })
    expect(preview).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /完成本部分知识/ })).not.toBeInTheDocument()
    expect(screen.getByText('切换到对应年级后才能记录学习进度')).toBeInTheDocument()
    expect(screen.getByLabelText('all knowledge progress')).toHaveTextContent(
      '{"grade1-2":[],"grade3-4":[],"grade5-6":["ael-1","ael-2","ael-3"]}',
    )
    expect(screen.queryByText(/获得 30 积分/)).not.toBeInTheDocument()
  })

  it('marks a reading complete once and adds thirty points', async () => {
    const user = userEvent.setup()
    render(
      <AppStateProvider>
        <CourseContentPage courseId="ael" chapterNum={4} onBack={() => undefined} />
      </AppStateProvider>,
    )

    await user.click(screen.getByRole('button', { name: '完成本部分知识' }))
    expect(screen.getByRole('status')).toHaveTextContent('获得 30 积分')

    await user.click(screen.getByRole('button', { name: '已完成本部分知识' }))
    expect(screen.getAllByText(/获得 30 积分/)).toHaveLength(1)
  })
})
