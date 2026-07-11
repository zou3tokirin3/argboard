Deno.test("loop test wiring is active", () => {
  const twoItems = ["capture", "board"];
  if (twoItems.length !== 2) throw new Error("Test runner wiring failed");
});
