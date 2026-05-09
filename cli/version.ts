/**
 * The version of the slopmop skill this CLI ships against. Sent as
 * `X-Skill-Version` on every API call so the server can flag staleness.
 *
 * Bump this in lockstep with `.claude/skills/slopmop/SKILL.md`'s frontmatter
 * `skillVersion` field. `scripts/build-cli.ts` asserts they match before
 * bundling.
 */
export const SKILL_VERSION = '2026-05-09.6'
