interface Player {
  codingamerId: number
  codingamerNickname: string
  codingamerHandle: string
  duration: number
  status: string
  testSessionStatus: string
  rank: number
  position: number
  testSessionHandle: string
}

interface Clash {
  globalRemainingTime: number
  publicHandle: string
  durationType: string
  mode: string
  publicClash: boolean
  players: Player[]
  type: string
}

interface Question {
  testCases: Array<{
    index: number
    inputBinaryId: number
    outputBinaryId: number
    label: string
  }>
  availableLanguages: Array<{
    id: string
    name: string
  }>[]
  stubGenerator: string
  id: number
  initialId: number
  type: string
  statement: string
  duration: number
  userId: number
  contribution: {
    moderators: Array<{
      userId: number
      pseudo: string
      publicHandle: string
      enable: boolean
      avatar: number
    }>
    type: string
    status: string
  }
  contributor: {
    userId: number
    pseudo: string
    publicHandle: string
    enable: boolean
    avatar: number
  }
  index: number
  mode: string
  title: string
}

interface ClashDetails {
  clash: Clash
  testType: string
  currentQuestion: {
    question: Question
    answer: any
  }
  direct: boolean
  questions: Array<{
    questionId: number
    title: string
    hasResult: boolean
  }>
  testSessionId: number
  testSessionHandle: string
  needAccount: boolean
}

interface ClashhReport {
  nbPlayersMin: number
  nbPlayersMax: number
  publicHandle: string
  clashDurationTypeId: string
  mode: string
  creationTime: string
  startTime: string
  endTime: string
  startTimestamp: number
  msBeforeStart: number
  msBeforeEnd: number
  finished: boolean
  started: boolean
  publicClash: boolean
  players: Array<{
    codingamerId: number
    codingamerNickname: string
    codingamerHandle: string
    codingamerAvatarId?: number
    score: number
    duration: number
    criterion: number
    status: string
    testSessionStatus: string
    languageId: string
    rank: number
    position: number
    solutionShared: boolean
    testSessionHandle: string
    submissionId: number
  }>
  programmingLanguages: any[]
  type: string
}

interface ClashSubmission {
  pseudo: string
  testSessionQuestionSubmissionId: number
  programmingLanguageId: string
  creationTime: number
  avatar: number
  codingamerId: number
  codingamerHandle: string
  code: string
  votableId: number
  commentableId: number
  shared: boolean
}
