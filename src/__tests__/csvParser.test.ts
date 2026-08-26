import { parseCsv, toCsv } from "../utils/csvParser";

describe("parseCsv", () => {
  test("parses a 2-level CSV correctly", () => {
    const csv = ",L1,L2\nx,A,X\nx,A,Y\nx,B,Z";
    const { result, duplicates } = parseCsv(csv);
    expect(duplicates).toHaveLength(0);
    expect(result.FieldsLists).toHaveLength(2);
    expect(result.FieldsLists[0]).toEqual([
      { Depend: "", Value: "A" },
      { Depend: "", Value: "B" },
    ]);
    expect(result.FieldsLists[1]).toEqual([
      { Depend: "A", Value: "X" },
      { Depend: "A", Value: "Y" },
      { Depend: "B", Value: "Z" },
    ]);
  });

  test("parses a 4-level CSV correctly", () => {
    const csv = ",L1,L2,L3,L4\nx,A,B,C,D\nx,A,B,C,E\nx,A,B,F,G";
    const { result, duplicates } = parseCsv(csv);
    expect(duplicates).toHaveLength(0);
    expect(result.FieldsLists).toHaveLength(4);
    expect(result.FieldsLists[3]).toContainEqual({ Depend: "ABC", Value: "D" });
    expect(result.FieldsLists[3]).toContainEqual({ Depend: "ABC", Value: "E" });
  });

  test("parses a 6-level CSV correctly", () => {
    const csv = ",L1,L2,L3,L4,L5,L6\nx,A,B,C,D,E,F";
    const { result } = parseCsv(csv);
    expect(result.FieldsLists).toHaveLength(6);
    expect(result.FieldsLists[5]).toContainEqual({ Depend: "ABCDE", Value: "F" });
  });

  test("deduplicates identical rows", () => {
    const csv = ",L1,L2\nx,A,B\nx,A,B\nx,A,B";
    const { result, duplicates } = parseCsv(csv);
    expect(duplicates).toHaveLength(2);
    expect(result.FieldsLists[0]).toHaveLength(1);
    expect(result.FieldsLists[1]).toHaveLength(1);
  });

  test("handles empty rows gracefully", () => {
    const csv = ",L1,L2\nx,A,B\n\nx,C,D\n";
    const { result } = parseCsv(csv);
    expect(result.FieldsLists[0]).toHaveLength(2);
  });

  test("returns empty FieldsLists for empty content", () => {
    const { result } = parseCsv(",L1,L2\n");
    expect(result.FieldsLists).toHaveLength(0);
  });
});

describe("toCsv", () => {
  test("round-trips a 2-level structure", () => {
    const csv = ",L1,L2\nx,A,X\nx,A,Y\nx,B,Z";
    const { result } = parseCsv(csv);
    const out = toCsv(result, ["L1", "L2"]);
    const lines = out.split("\n").slice(1).sort();
    expect(lines).toEqual(["x,A,X", "x,A,Y", "x,B,Z"].sort());
  });
});
