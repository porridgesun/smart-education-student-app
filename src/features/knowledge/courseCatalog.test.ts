import { describe, expect, it } from 'vitest'
import { COURSE_PACKAGES, getCourseForBand, getQuizForPart } from './courseCatalog'
import { getCourseData } from './knowledgeData'
import { getQuiz } from '../test/quizData'
import { GRADE56_LESSON_DETAILS, getGrade56LessonDetail } from './content/grade56Content'

const retiredCopy = new RegExp([
  '初' + '中',
  '中学' + '生',
  '七至' + '九年级',
  '7' + '—9',
].join('|'))

describe('primary course packages', () => {
  it('gives every AI exploration chapter a complete primary-school lesson detail', () => {
    const course = COURSE_PACKAGES['grade5-6']
    const details = course.parts.map((part) => GRADE56_LESSON_DETAILS[part.id])

    expect(details).toHaveLength(9)
    expect(details.every((detail) => detail)).toBe(true)
    expect(details.every((detail) => (
      detail.intro.trim().length >= 80
      && detail.visualSteps.length >= 3
      && detail.experiment.steps.length >= 3
      && detail.safetyChecklist.length >= 2
      && detail.challenge.instructions.length >= 2
      && detail.challenge.successHint.trim().length > 0
    ))).toBe(true)
    expect(JSON.stringify(details)).not.toMatch(retiredCopy)
  })

  it('offers optional videos only for the five supported exploration chapters', () => {
    const videos = Object.entries(GRADE56_LESSON_DETAILS)
      .filter(([, detail]) => detail.video)
      .map(([partId, detail]) => ({ partId, ...detail.video }))

    expect(videos.map(({ partId }) => partId)).toEqual(['ael-1', 'ael-3', 'ael-4', 'ael-6', 'ael-9'])
    expect(videos.every((video) => (
      /^BV[0-9A-Za-z]{10}$/.test(video.bvid ?? '')
      && (video.title?.trim().length ?? 0) > 0
      && (video.watchPrompt?.match(/？/g)?.length ?? 0) >= 2
      && (video.watchPrompt?.match(/？/g)?.length ?? 0) <= 3
    ))).toBe(true)
  })

  it('resolves lesson details by stable chapter id without leaking into other courses', () => {
    for (const part of COURSE_PACKAGES['grade5-6'].parts) {
      expect(getGrade56LessonDetail(part.id)).toBe(GRADE56_LESSON_DETAILS[part.id])
    }
    expect(getGrade56LessonDetail('ael-10')).toBeUndefined()
    expect(getGrade56LessonDetail('qmx-1')).toBeUndefined()
    expect(getGrade56LessonDetail('cxd-1')).toBeUndefined()
  })

  it.each([
    ['grade1-2', 'qmx', 8],
    ['grade3-4', 'cxd', 6],
    ['grade5-6', 'ael', 9],
  ] as const)('maps %s to %s with aligned parts, quizzes and medals', (band, id, count) => {
    const course = getCourseForBand(band)
    expect(course.id).toBe(id)
    expect(course.parts).toHaveLength(count)
    expect(course.quizzes).toHaveLength(count)
    expect(course.medals).toHaveLength(count)
    expect(course.parts.map((part) => part.id)).toEqual(course.quizzes.map((quiz) => quiz.partId))
    expect(course.parts.map((part) => part.id)).toEqual(course.medals.map((medal) => medal.partId))
  })

  it('gives every grade 5-6 quiz five answerable questions and a ninth project challenge', () => {
    const course = COURSE_PACKAGES['grade5-6']
    expect(course.parts.map((part) => part.title)).toEqual([
      'AI 系统拆解站', '数据侦探营', '算法工具箱', '第一次 AI 实验', '给 AI 当评委',
      '生成式 AI 解密', '从点子到产品', '与 AI 安全相处', '我的 AI 小项目',
    ])
    expect(course.quizzes.every((quiz) => quiz.questions.length === 5)).toBe(true)
    expect(course.quizzes[8].questions.some((question) => question.type === 'scenario')).toBe(true)
    expect(JSON.stringify(course)).not.toMatch(retiredCopy)
  })

  it('introduces every approved grade 5-6 term once with an explanation and analogy', () => {
    const requiredTerms = [
      '数据', '算法', '模型', '算力', '标注', '训练', '准确率',
      '生成式 AI', '原型', '深度伪造', '信息茧房', '版权',
    ]
    const parts = COURSE_PACKAGES['grade5-6'].parts
    const introductions = parts.flatMap((part) => (
      part.keyConcepts.map((concept) => ({ ...concept, partNumber: part.number }))
    ))

    expect(introductions.map((concept) => concept.term)).toEqual(requiredTerms)
    expect(introductions.every((concept) => (
      concept.explanation.trim().length > 0
      && concept.analogy.trim().length > 0
      && concept.explanation !== concept.analogy
    ))).toBe(true)

    for (const concept of introductions) {
      const firstMention = parts.find((part) => (
        [part.title, part.summary, part.concept, part.experiment, part.safety, part.challenge]
          .some((text) => text.includes(concept.term))
      ))
      expect(firstMention?.number, `${concept.term} should be explained at first use`).toBe(concept.partNumber)
    }
  })

  it('models the project privacy response as a three-action scenario', () => {
    const privacyQuestion = COURSE_PACKAGES['grade5-6'].quizzes[8].questions.find(
      (question) => question.id === 'ael-9-q4',
    )

    expect(privacyQuestion).toMatchObject({
      type: 'scenario',
      options: ['停止收集并改用不敏感的方案', '继续收集', '悄悄保存'],
    })
  })

  it('finds each quiz by the same stable part id', () => {
    expect(getQuizForPart('qmx-1')?.title).toBe('启明星岛 · 认识 AI')
    expect(getQuizForPart('cxd-6')?.title).toBe('负责任的创想家')
    expect(getQuizForPart('ael-9')?.title).toBe('我的 AI 小项目')
    expect(getQuizForPart('ael-10')).toBeUndefined()
  })

  it('keeps every answer index inside an explicit option list', () => {
    const questions = Object.values(COURSE_PACKAGES).flatMap((course) =>
      course.quizzes.flatMap((quiz) => quiz.questions),
    )
    expect(questions.every((question) =>
      question.options.length >= 2
      && question.options.length <= 4
      && question.answerIndex >= 0
      && question.answerIndex < question.options.length,
    )).toBe(true)
  })

  it('uses the approved deterministic prompts for the grade 5-6 algorithm and project chapters', () => {
    expect(COURSE_PACKAGES['grade5-6'].quizzes[2].questions.map((question) => question.prompt)).toEqual([
      '把照片分成猫和狗，最适合哪种工具？',
      '没有现成标签，想把相似图书放在一起，应选择什么？',
      '根据过去气温估计明天的温度，更像哪类任务？',
      '推荐系统给出的第一名一定是唯一正确选择。',
      '为同学推荐课外书，怎样做更合适？',
    ])
    expect(COURSE_PACKAGES['grade5-6'].quizzes[8].questions.map((question) => question.prompt)).toEqual([
      '哪个问题最适合做成第一个 AI 小项目？',
      '项目需要哪些最少输入？',
      '怎样测试方案是否真的有用？',
      '发现会收集同学人脸时应该怎么办？',
      '第一次测试效果一般，下一步最好的做法是什么？',
    ])
  })

  it('aligns the grade 5 course data with the nine-part primary package', () => {
    const course = getCourseData('grade5')
    const quiz = getQuiz('ael')
    expect(course.chapters?.map((chapter) => chapter.title)).toEqual(
      COURSE_PACKAGES['grade5-6'].parts.map((part) => part.title),
    )
    expect(quiz).toHaveLength(9)
    expect(JSON.stringify({ course, quiz })).not.toMatch(retiredCopy)
  })

  it.each([
    ['grade1', 'qmx'], ['grade2', 'qmx'],
    ['grade3', 'cxd'], ['grade4', 'cxd'],
    ['grade5', 'ael'], ['grade6', 'ael'],
  ] as const)('keeps the primary grade selector aligned for %s', (grade, courseId) => {
    expect(getCourseData(grade).id).toBe(courseId)
  })
})
