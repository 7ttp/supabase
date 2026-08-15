import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

import commonCliSections from './common-cli-sections.json' with { type: 'json' }

/**
 * The CLI reference page tree is built by `genCliSectionTree()` in
 * `features/docs/Reference.generated.script.ts`, which filters
 * common-cli-sections.json down to entries whose id exists in the spec:
 *
 *     section.type === 'cli-command' ? cliSpec.commands.some(({ id }) => id === section.id) : true
 *
 * and then keys the generated pages by slug in `writeCliReferenceSections()`:
 *
 *     keyBy(flattenedCliSections.filter(({ slug }) => !!slug), (section) => section.slug)
 *
 * So common-cli-sections.json is the DRIVER and the spec is only a FILTER. A
 * command that lands in the spec without a matching entry here gets no page at
 * all, and nothing errors — which is how the commands in KNOWN_MISSING_PAGES
 * ended up undocumented while the spec sat frozen at 2.98.2.
 *
 * These assertions are a ratchet, not a clean bill of health: the known gaps are
 * listed explicitly so that regenerating the spec cannot quietly add more.
 */

/**
 * Commands the published spec defines that have no sidebar entry, and therefore
 * no page on supabase.com. Shrink this list by adding entries to
 * common-cli-sections.json — never grow it.
 */
const KNOWN_MISSING_PAGES = [
  'supabase-backups',
  'supabase-backups-list',
  'supabase-backups-restore',
  'supabase-db-advisors',
  'supabase-db-query',
  'supabase-db-schema',
  'supabase-db-schema-declarative',
  'supabase-db-schema-declarative-generate',
  'supabase-db-schema-declarative-sync',
  'supabase-encryption',
  'supabase-encryption-get-root-key',
  'supabase-encryption-update-root-key',
  'supabase-gen-bearer-jwt',
  'supabase-inspect',
  'supabase-logout',
  'supabase-telemetry-disable',
  'supabase-telemetry-enable',
  'supabase-telemetry-status',
  'supabase-unlink',
]

/**
 * Sidebar entries pointing at commands the spec no longer defines. They are
 * filtered out at build time rather than breaking the page, so nothing else
 * would ever surface them.
 */
const KNOWN_ORPHANED_ENTRIES = ['supabase-branches-disable']

interface CliSection {
  readonly id?: string
  readonly slug?: string
  readonly type?: string
  readonly items?: ReadonlyArray<CliSection>
}

interface CliSpec {
  readonly commands: ReadonlyArray<{ readonly id: string }>
}

function collectCommandSections(
  sections: ReadonlyArray<CliSection>,
  acc: Array<CliSection> = []
): Array<CliSection> {
  for (const section of sections) {
    if (section.type === 'cli-command') acc.push(section)
    if (section.items) collectCommandSections(section.items, acc)
  }
  return acc
}

const sectionCommands = collectCommandSections(commonCliSections as ReadonlyArray<CliSection>)
const sectionIds = sectionCommands.map((section) => section.id ?? '')

async function readSpec(): Promise<CliSpec> {
  return yaml.load(
    await readFile(join(import.meta.dirname, 'cli_v1_commands.yaml'), 'utf-8')
  ) as CliSpec
}

describe('CLI reference coverage', () => {
  it('gives every command in the spec a page in the sidebar', async () => {
    const spec = await readSpec()

    const missing = spec.commands
      .map(({ id }) => id)
      .filter((id) => !sectionIds.includes(id))
      .sort()

    // Regenerating the spec is only half the job: new commands also need an
    // entry in common-cli-sections.json or they are published nowhere. If this
    // fails with extra ids, add them there; if it fails because an id is gone,
    // drop it from KNOWN_MISSING_PAGES.
    expect(missing).toEqual([...KNOWN_MISSING_PAGES].sort())
  })

  it('has no sidebar entry pointing at a command the spec no longer defines', async () => {
    const spec = await readSpec()
    const specIds = spec.commands.map(({ id }) => id)

    const orphaned = sectionIds.filter((id) => !specIds.includes(id)).sort()

    expect(orphaned).toEqual([...KNOWN_ORPHANED_ENTRIES].sort())
  })

  it('lists each command exactly once', () => {
    const duplicated = sectionIds
      .filter((id, index) => sectionIds.indexOf(id) !== index)
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .sort()

    expect(duplicated).toEqual([])
  })

  it('gives every command a slug to be published under', () => {
    const slugless = sectionCommands
      .filter((section) => !section.slug)
      .map((section) => section.id ?? '(no id)')
      .sort()

    // A sidebar entry with no slug is dropped before it becomes a page.
    expect(slugless).toEqual([])
  })

  it('never publishes two commands under the same slug', () => {
    const slugs = sectionCommands.map((section) => section.slug ?? '')
    const duplicated = slugs
      .filter((slug, index) => slugs.indexOf(slug) !== index)
      .filter((slug, index, all) => all.indexOf(slug) === index)
      .sort()

    // Two entries sharing a slug collapse into one page, silently losing the other.
    expect(duplicated).toEqual([])
  })
})
