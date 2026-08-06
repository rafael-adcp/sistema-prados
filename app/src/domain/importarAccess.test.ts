import { describe, expect, it } from "vitest";
import { converterCsvDoAccess, parseCsv } from "./importarAccess";

const HOJE = "2026-08-05";

describe("parseCsv", () => {
  it("entende aspas, vírgulas e aspas duplas escapadas", () => {
    expect(parseCsv('"a","b,c","d""e"')).toEqual([["a", "b,c", 'd"e']]);
  });

  it("entende quebras de linha CRLF e campo com quebra interna", () => {
    expect(parseCsv('"a","b\nc"\r\n"d","e"')).toEqual([
      ["a", "b\nc"],
      ["d", "e"],
    ]);
  });

  it("aguenta o lixo real do sistema antigo (km só de apóstrofos)", () => {
    expect(parseCsv('"7","SANTANA","\'\'\'\'","BFD6186"')).toEqual([
      ["7", "SANTANA", "''''", "BFD6186"],
    ]);
  });
});

describe("converterCsvDoAccess", () => {
  const csv = [
    "codigo,carro,km,placa,produto,data",
    '"2","PALIO ED  1.0 8V","126.705","J","3 SELENIA K PH4558","2007-10-01"',
    '"7","SANTANA","\'\'\'\'","BFD 6186","3SL BR","2006-10-01"',
    '"9","VERONA","086490","cxh2089","3 SJ",""',
    '"10","UNO","240244","BIW5232","4 BR SJ","2042-02-10"',
  ].join("\n");

  // No .mdb real são 40 registros em caixa mista. Ficando assim no banco, eles
  // apareciam como produto duplicado no "mais usados" e como falso "mesma placa
  // com carros diferentes" — só por causa da caixa.
  it("normaliza carro e produto para maiúsculas, como a escrita do dia a dia", () => {
    const misto = [
      "codigo,carro,km,placa,produto,data",
      '"1","STRADA TREKKING FIRE FLEX 1.4 8v","100","AAA0001","3,5 HAV 5W30 g9890f","2020-01-10"',
    ].join("\n");
    const [servico] = converterCsvDoAccess(misto, HOJE).servicos;
    expect(servico.carro).toBe("STRADA TREKKING FIRE FLEX 1.4 8V");
    expect(servico.produto).toBe("3,5 HAV 5W30 G9890F");
  });

  it("preserva todos os registros com o código original", () => {
    const resultado = converterCsvDoAccess(csv, HOJE);
    expect(resultado.servicos.map((s) => s.id)).toEqual([2, 7, 9, 10]);
  });

  it("aplica as regras do domínio: km, placa canônica e flag de data", () => {
    const [palio, santana, verona, uno] = converterCsvDoAccess(csv, HOJE).servicos;
    expect(palio.km).toBe(126705);
    expect(santana.km).toBeNull();
    expect(santana.kmRaw).toBe("''''");
    expect(santana.placa).toBe("BFD6186");
    expect(verona.placa).toBe("CXH2089");
    expect(verona.data).toBeNull();
    expect(uno.dataSuspeita).toBe(true);
  });

  it("conta as anomalias sem descartar nada", () => {
    const resultado = converterCsvDoAccess(csv, HOJE);
    expect(resultado.semData).toBe(1);
    expect(resultado.datasSuspeitas).toBe(1);
    expect(resultado.servicos.length).toBe(4);
  });

  it("remove o BOM e rejeita arquivo de outro formato", () => {
    expect(converterCsvDoAccess(`﻿${csv}`, HOJE).servicos.length).toBe(4);
    expect(() => converterCsvDoAccess("foo,bar\n1,2", HOJE)).toThrow(/formato esperado/);
  });
});
