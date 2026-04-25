import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeHandoff, readHandoff, listHandoffs } from "../handoff.js";

function tmp() {
  return mkdtempSync(join(tmpdir(), "bw-handoff-"));
}

describe("handoff module", () => {
  it("round-trips a handoff: write then read", async () => {
    const cwd = tmp();
    try {
      const path = await writeHandoff(
        {
          stage: "plan",
          decided: ["Use OAuth2 PKCE flow", "Reject implicit grant"],
          rejected: ["password grant — disallowed by OAuth2.1"],
          risks: ["redirect_uri allowlist must be exact-match"],
          files: ["src/auth/oauth.ts"],
          remaining: ["wire into login route"],
        },
        cwd,
      );
      expect(path.endsWith("plan.md")).toBe(true);

      const loaded = await readHandoff("plan", cwd);
      expect(loaded).not.toBeNull();
      expect(loaded!.decided).toContain("Use OAuth2 PKCE flow");
      expect(loaded!.rejected[0]).toContain("password grant");
      expect(loaded!.risks).toHaveLength(1);
      expect(loaded!.files).toEqual(["src/auth/oauth.ts"]);
      expect(loaded!.remaining[0]).toBe("wire into login route");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("returns null when stage handoff doesn't exist", async () => {
    const cwd = tmp();
    try {
      const result = await readHandoff("nonexistent", cwd);
      expect(result).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("listHandoffs enumerates written stages alphabetically", async () => {
    const cwd = tmp();
    try {
      await writeHandoff({ stage: "verify", decided: [], rejected: [], risks: [], files: [], remaining: [] }, cwd);
      await writeHandoff({ stage: "exec", decided: [], rejected: [], risks: [], files: [], remaining: [] }, cwd);
      await writeHandoff({ stage: "plan", decided: [], rejected: [], risks: [], files: [], remaining: [] }, cwd);
      const stages = await listHandoffs(cwd);
      expect(stages).toEqual(["exec", "plan", "verify"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects path-traversal stage names", async () => {
    const cwd = tmp();
    try {
      await expect(
        writeHandoff(
          { stage: "../escape", decided: [], rejected: [], risks: [], files: [], remaining: [] },
          cwd,
        ),
      ).rejects.toThrow(/invalid stage/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("empty sections render as _(none)_ and parse back to []", async () => {
    const cwd = tmp();
    try {
      await writeHandoff(
        { stage: "fix", decided: ["one"], rejected: [], risks: [], files: [], remaining: [] },
        cwd,
      );
      const loaded = await readHandoff("fix", cwd);
      expect(loaded!.decided).toEqual(["one"]);
      expect(loaded!.rejected).toEqual([]);
      expect(loaded!.risks).toEqual([]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
