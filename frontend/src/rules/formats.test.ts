import { describe, expect, it } from 'vitest'
import { brdRequirements, defaultFormat, FORMAT_SECTIONS, glossary, openQuestions, PRIORITY_TABLE, srsBlock } from './formats'
import { requirementsFromText } from '../demo/ai/agents'
import { project } from './fixtures.test-helpers'

const p = project()
const sec = (content: string) => [{ id: 's', key: 's', title: 's', content, factKeys: [] }]

describe('BRAC formats', () => {
  it('picks BRD Template A, and the SRS from the Update / New label', () => {
    expect(defaultFormat('BRD')).toBe('BRD_A')
    expect(defaultFormat('SRS', 'update')).toBe('SRS_CR')
    expect(defaultFormat('SRS', 'new')).toBe('SRS_FULL')
    expect(defaultFormat('PROPOSAL')).toBeUndefined()
  })

  it('has the 13 numbered sections of Template A in order, then Open Questions', () => {
    expect(FORMAT_SECTIONS.BRD_A.map((x) => x.title.split(' ')[0])).toEqual(['1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0', '8.0', '9.0', '10.0', '11.0', '12.0', '13.0', 'Open'])
  })

  it('builds 8.0 with the priority table word for word and all six groups, and the requirements can be read back', () => {
    const md = brdRequirements('BRD_A', '- Change the home screen.', [{ id: 'FR-B-001', text: 'Members see their savings', supports: 'OBJ-1' }], [])
    expect(md).toContain(PRIORITY_TABLE)
    for (const g of ['Business User Requirements', 'Reporting Requirements', 'User Access/Security Requirements', 'Usability Requirements', 'Audit Requirements', 'Support and Maintenance Requirements']) expect(md).toContain(g)
    expect(md).toContain('Prototype Reff')
    expect(requirementsFromText(p, 'BRD', sec(md))).toEqual([{ id: 'FR-B-001', projectId: 'p1', docType: 'BRD', text: 'Members see their savings', parentId: 'OBJ-1' }])
  })

  it('reads SRS requirements back from the FR blocks, with what they trace to', () => {
    const md = srsBlock('SRS_FULL', 1, { id: 'FR-01', text: 'Approve leave requests in the ERP', supports: 'FR-B-001' }, ['The system shall show pending requests.'])
    expect(md).toMatch(/#### Acceptance Criteria/)
    expect(requirementsFromText(p, 'SRS', sec(md))).toEqual([{ id: 'FR-01', projectId: 'p1', docType: 'SRS', text: 'Approve leave requests in the ERP', parentId: 'FR-B-001' }])
  })

  it('lists the glossary terms used and every placeholder once', () => {
    expect(glossary('The CO and the BM use DCS.')).toMatch(/Credit Officer[\s\S]*Branch Manager/)
    expect(openQuestions('a <Module> b <Module> c <1–5>')).toBe('These were left as placeholders and need an answer:\n\n- Module\n- 1–5')
  })
})
