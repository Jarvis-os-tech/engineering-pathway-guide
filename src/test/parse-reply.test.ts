import { describe, it, expect } from "vitest";
import { parseReply } from "@/routes/index";

describe("parseReply", () => {
  it("extracts stage and options and hides them from the answer", () => {
    const r = parseReply("Great choice!\nWhat is your budget?\nSTAGE: 4\nOPTIONS: Under ₹2 lakh | ₹2–4 lakh | Above ₹4 lakh");
    expect(r.body).toBe("Great choice!\nWhat is your budget?");
    expect(r.stage).toBe(4);
    expect(r.options).toEqual(["Under ₹2 lakh", "₹2–4 lakh", "Above ₹4 lakh"]);
  });
});
