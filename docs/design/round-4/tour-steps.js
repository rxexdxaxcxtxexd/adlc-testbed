// Every word of the guided tour, every step's target and every step's autoplay time.
// Edit copy here; tour.js reads this file and holds no text of its own.
//   view   : the screen the step opens (projects, compliance, worklist, record, holds, directory, notifications)
//   target : CSS selector of the live element to spotlight; null centres the card
//   ms     : autoplay time for the step in milliseconds
// Voice: what an admin sees. Plain, transparent, nothing hidden. Title under 7 words, body under 25.
window.TOUR_CONFIG = {
  storageKey: 'coi.tour.seen.v3',
  defaultMs: 6500,
  labels: {
    region: 'Product tour',
    count: '{n} of {total}',
    next: 'Next',
    back: 'Back',
    done: 'Finish',
    skip: 'Skip',
    play: 'Autoplay',
    pause: 'Pause',
    closed: 'Tour closed.'
  },
  welcome: {
    eyebrow: 'Welcome to COI Check',
    title: 'No coverage? No payment.',
    body: 'See what we catch, what we hold, and what\u2019s yours to call.',
    start: 'Show me around',
    later: 'I\u2019ll explore',
    minutes: '1 minute \u00b7 replay anytime',
    demoLabel: 'This morning',
    demo: [
      { name: 'Cedar Masonry', from: 'On hold', to: '$6,250 released', tone: 'green' },
      { name: 'Brightway Electric', from: 'Checking', to: 'Approved', tone: 'green' },
      { name: 'Ridgeline Roofing', from: 'Checking', to: 'Sent to Marcus', tone: 'amber' }
    ]
  },
  hint: 'Replay the tour anytime from here.',
  finale: {
    title: 'You\u2019re all set',
    body: 'Replay anytime from Tour.'
  },
  steps: [
    {
      id: 'problem', view: 'projects', target: '[data-tour="projects"]', ms: 6500,
      title: 'No payment without valid coverage',
      body: 'Every certificate, on every project, tracked. Payment waits until it\u2019s right.'
    },
    {
      id: 'exceptions', view: 'worklist', target: '[data-tour="filters"]', ms: 6500,
      title: 'Only exceptions reach you',
      body: 'Certificates check themselves. Only what needs you lands here.'
    },
    {
      id: 'roles', view: 'record', target: '[data-tour="confidence"]', ms: 7000,
      title: 'AI reads. Code decides. You approve.',
      body: 'Under 85% confidence, a person checks it first.'
    },
    {
      id: 'holds', view: 'holds', target: '[data-tour="payrun"]', ms: 7000,
      title: 'Payments wait until coverage is right',
      body: 'Holds set and lift on their own. Every dollar and reason in view.'
    },
    {
      id: 'directory', view: 'directory', target: '[data-tour="directory"]', ms: 6000,
      title: 'Every subcontractor in one place',
      body: 'Contacts, status, certificates and messages, together.'
    },
    {
      id: 'communications', view: 'notifications', target: '[data-tour="notifications"]', ms: 6500,
      title: 'Nothing goes out unseen',
      body: 'Every message logged with who approved it. Nothing reaches a sub unseen.'
    },
    {
      id: 'morning', view: 'worklist', target: '[data-tour="worklist"]', ms: 6000,
      title: 'Your morning, in two moves',
      body: 'Clear your Worklist. Check holds before the pay run. That\u2019s it.'
    }
  ]
};
