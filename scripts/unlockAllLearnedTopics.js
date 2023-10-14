//
// Codingame introduced the topics feature, this script will unlock all of them if you finished the corresponding puzzles
// Note: this does around a thousand requests, so it might take a while to complete
//

// User ID in short format like 1234321, you can find it by viewing source of Codingame page
// `"userId":1234321,"email`:"..."
const userId = ''

const categories = [
  'BFS',
  'graphs',
  'conditions',
  'arrays',
  'loops',
  'strings',
  'encoding',
  'hash-tables',
  'distance',
  'trigonometry',
  'medians',
  'sequences',
  'sets',
  'tries',
  'memoization',
  'recursion',
  'state-machine',
  'simulation',
  'greedy',
  'radix',
  'pathfinding',
  'backtracking',
  'DFS',
  'barycenter',
  'scheduling',
  'dynamic-programming',
  'parsing',
  'permutations',
  'flood-fill',
  'regression-analysis',
  'image-processing',
  'pattern-recognition',
  'binary-search',
  'intervals',
  'brute-force',
  'cryptology',
  'queues',
  'lists',
  'optimization',
  'minimax',
  'resource-management',
  'multi-agent',
  'reverse',
  'machine-learning',
  'stack',
  'reverse-polish-notation',
  'interpreter',
  '2d-array',
  'coordinates',
  'ascii-art',
  'string-manipulation',
  'neural-network',
  'arithmetic',
  'tricky',
  'compression',
  'trees',
  'algebra',
  'mathematics',
  'modular-calculus',
  'combinatorics',
  'primes',
]

const puzzlesByCategory = {}

for (const category of categories) {
  await fetch('https://www.codingame.com/services/Topic/findTopicPageByTopicHandle', {
    headers: {
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.5',
      'content-type': 'application/json;charset=UTF-8',
      'sec-ch-ua': '"Brave";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'sec-gpc': '1',
    },
    referrer: 'https://www.codingame.com/learn/conditions',
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: `["${category}"]`,
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
  })
    .then(response => response.json())
    .then(data => {
      data.relatedPuzzles.forEach(puzzle => {
        if (!puzzlesByCategory[data.topic.id]) {
          puzzlesByCategory[data.topic.id] = []
        }
        puzzlesByCategory[data.topic.id].push(puzzle.id)
      })
    })
}

for (const [topicId, puzzles] of Object.entries(puzzlesByCategory)) {
  for (const puzzleId of puzzles) {
    await fetch('https://www.codingame.com/services/CodingamerPuzzleTopic/markAsLearned', {
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.5',
        'content-type': 'application/json;charset=UTF-8',
        'sec-ch-ua': '"Brave";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
      },
      referrer: 'https://www.codingame.com/ide/puzzle/mars-lander-episode-1',
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: `[${userId},${puzzleId},${topicId},true]`,
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
    })
  }
}
