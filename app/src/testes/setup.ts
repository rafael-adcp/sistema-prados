import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sem `globals: true` no Vitest, o Testing Library não consegue registrar o
// auto-cleanup sozinho — sem isto, cada render vaza para o teste seguinte.
afterEach(() => cleanup());
