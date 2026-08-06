import { describe, expect, it } from "vitest";
import { deveFazerBackupAutomatico } from "./backup";

describe("deveFazerBackupAutomatico", () => {
  it("faz quando nunca houve backup", () => {
    expect(deveFazerBackupAutomatico(null, "2026-08-05")).toBe(true);
  });

  it("faz quando o último é de ontem ou mais antigo", () => {
    expect(deveFazerBackupAutomatico("2026-08-04", "2026-08-05")).toBe(true);
    expect(deveFazerBackupAutomatico("2026-07-29", "2026-08-05")).toBe(true);
  });

  it("não faz duas vezes no mesmo dia (abrir e fechar o app não gera cópia nova)", () => {
    expect(deveFazerBackupAutomatico("2026-08-05", "2026-08-05")).toBe(false);
  });
});
