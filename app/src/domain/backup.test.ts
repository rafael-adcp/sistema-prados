import { describe, expect, it } from "vitest";
import { deveFazerBackupAutomatico } from "./backup";

describe("deveFazerBackupAutomatico", () => {
  it("faz quando nunca houve backup", () => {
    expect(deveFazerBackupAutomatico(null, "2026-08-05")).toBe(true);
  });

  it("faz quando o último tem 7 dias ou mais", () => {
    expect(deveFazerBackupAutomatico("2026-07-29", "2026-08-05")).toBe(true);
  });

  it("não faz quando o último é recente", () => {
    expect(deveFazerBackupAutomatico("2026-08-01", "2026-08-05")).toBe(false);
  });
});
