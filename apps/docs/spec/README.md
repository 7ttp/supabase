# Supabase Specs

These spec files are used to generate the [reference documentation](https://supabase.com/docs/reference/cli/introduction).

## Preparation

To get started, run `make init`. This installs all dependencies.

## Usage

```bash

make                # download and transform specs into docs

```

## CLI reference

`cli_v1_commands.yaml` is not fetched by the `make` targets above. supabase/cli
generates it from its own command tree on release and opens a PR here, so this
repo only ever receives the file. Nothing in this directory regenerates it.

Pages come from `common-cli-sections.json`, not from the spec — the spec only
filters that sidebar down to commands that exist. A command that arrives in the
spec without an entry there is published nowhere, and nothing errors, so
`cli-reference-coverage.test.ts` guards the two against drifting apart.
