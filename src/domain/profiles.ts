import type { ProfileId } from './types.ts'

export const flagshipQuestion = "I'm seeing lower conversion in the retirement account-opening journey. What's going on?"

export const profiles: Record<ProfileId, { label: string; short: string; description: string; questions: { title: string; question: string; category: string }[] }> = {
  retirement: {
    label: 'Retirement business leader', short: 'Retirement', description: 'A clearer view of your retirement business.',
    questions: [
      { title: 'What is behind the conversion decline?', question: flagshipQuestion, category: 'Journey intelligence' },
      { title: 'How are Roth IRA openings trending?', question: 'How many Roth IRA accounts were opened this year compared with last year?', category: 'Account growth' },
      { title: 'Why are rollover support calls increasing?', question: 'Why are calls and Fidelity Assistant questions about rollovers increasing?', category: 'Customer signals' },
      { title: 'Where are we losing retirement customers?', question: 'What is driving customer attrition in retirement?', category: 'Retention' },
      { title: 'Which customers have outstanding RMDs?', question: 'Which retirement customer cohorts have outstanding RMDs this year?', category: 'Explore a new question' },
    ],
  },
  wealth: {
    label: 'Wealth business leader', short: 'Wealth', description: 'Understand the relationships behind your business.',
    questions: [
      { title: 'How is volatility changing customer behavior?', question: 'How is market volatility affecting trading and customer engagement?', category: 'Market intelligence' },
      { title: 'How are wealth appointments converting?', question: 'How are wealth appointments converting to funded accounts?', category: 'Relationship growth' },
      { title: 'What is changing in household net flows?', question: 'Compare wealth household net flows this year versus last year.', category: 'Money movement' },
      { title: 'Which campaigns deepen relationships?', question: 'Which wealth campaigns improved customer engagement?', category: 'Campaign intelligence' },
    ],
  },
  digital: {
    label: 'Digital experience leader', short: 'Digital experience', description: 'Connect digital experiences to customer outcomes.',
    questions: [
      { title: 'What changed in retirement conversion?', question: flagshipQuestion, category: 'Journey intelligence' },
      { title: 'How are HSA account openings trending?', question: 'How are HSA account-opening trends changing this year compared with last year?', category: 'Account growth' },
      { title: 'What are customers searching for?', question: 'What are customers searching for on our website and mobile app?', category: 'Search intelligence' },
      { title: 'What are social conversations telling us?', question: 'What are the latest social conversation themes about our mobile app?', category: 'Customer signals' },
    ],
  },
  service: {
    label: 'Customer service and engagement leader', short: 'Customer engagement', description: 'Hear the signals across every customer interaction.',
    questions: [
      { title: 'Why are rollover questions increasing?', question: 'Why are calls and Fidelity Assistant questions about rollovers increasing?', category: 'Contact drivers' },
      { title: 'What is behind retirement journey friction?', question: flagshipQuestion, category: 'Journey intelligence' },
      { title: 'How is volatility affecting engagement?', question: 'How is market volatility affecting trading and customer engagement?', category: 'Market intelligence' },
      { title: 'What explains live-chat transfers?', question: 'Why are retirement live-chat transfers increasing?', category: 'Explore a new question' },
    ],
  },
}
