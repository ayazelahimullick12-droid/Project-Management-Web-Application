/** Help: short "How do I…" answers for the most common jobs, in plain words. Used by both views. */
import { BookOpen, CircleHelp } from 'lucide-react'
import { More, Row, Rows, Section, SimplePage } from './parts'

const ANSWERS: [string, string[]][] = [
  ['How do I approve a document?', [
    'Open **To do**. Click the card that says **Approve**.',
    'Read the document. The blue box at the top says what changed since last time.',
    'At the bottom of the screen, click **Approve**, or **Ask for changes** and write what should change.',
    'Documents that need a signature ask for your password, or a code sent to your email.',
  ]],
  ['How do I answer the team’s questions?', [
    'Open **To do** and click **Answer**. You see one question at a time.',
    'Write your answer in your own words and click **Save answer**.',
    'If you do not know, click **I don’t know**. That is a fine answer.',
  ]],
  ['How do I comment on a document?', [
    'Select some text in the document with your mouse. Two buttons appear: **Comment** and **Suggest wording**.',
    'Click **Comments** above the document to see everyone’s comments.',
  ]],
  ['How do I test the new system?', [
    'Open **To do** and click **Start testing**.',
    'Follow the steps of each test, then choose **Pass** or **Fail**.',
    'If something did not work, describe it in your own words. The AI writes it up properly for the developers.',
  ]],
  ['How do I talk to the team?', [
    'Click **Messages** at the top. Each project has a **Team chat**, and you can message one person directly.',
  ]],
  ['The text is too small, or the screen is too busy', [
    'Click your name at the top right and choose a larger **Text size**.',
    'The **Simple / Full** switch at the top changes how much is shown. Simple shows one job per page. Full shows every tool, for people who use the app all day.',
  ]],
]

/** Turns **bold** in the answers into bold text. */
function Line({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>))}
    </>
  )
}

export function HelpPage() {
  return (
    <SimplePage title="Help" subtitle="Short answers to the most common questions.">
      <div className="space-y-3">
        {ANSWERS.map(([q, steps]) => (
          <div key={q} className="rounded-2xl bg-surface px-5 py-4 ring-1 ring-line">
            <More label={<span className="text-ink">{q}</span>}>
              <ol className="ml-7 list-decimal space-y-2 text-lg leading-relaxed">
                {steps.map((s, i) => (
                  <li key={i}>
                    <Line text={s} />
                  </li>
                ))}
              </ol>
            </More>
          </div>
        ))}
      </div>
      <Section title="About this prototype">
        <Rows>
          <Row to="/how-it-works" icon={<BookOpen className="h-6 w-6 text-muted" />} title="How the real app works" subtitle="The AI models, signing, calls and security, in plain language" />
          <Row to="/open-questions" icon={<CircleHelp className="h-6 w-6 text-muted" />} title="Open questions" subtitle="What the specification leaves open, and what this prototype assumes" />
        </Rows>
      </Section>
    </SimplePage>
  )
}
