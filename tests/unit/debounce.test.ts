import { test } from "node:test";
import { debounce } from "../../ui/debounce.ts";

test("debounce delays invocation", async () => {
  let count: number = 0;
  const fn = debounce(() => {
    count++;
  }, 50);

  fn();
  fn();
  if (count !== 0) throw new Error("should not run immediately");

  await new Promise((resolve) => setTimeout(resolve, 60));
  if (count < 1) throw new Error("should run once after delay");
});

test("debounce cancel prevents pending run", async () => {
  let count: number = 0;
  const fn = debounce(() => {
    count++;
  }, 50);

  fn();
  fn.cancel();

  await new Promise((resolve) => setTimeout(resolve, 60));
  if (count !== 0) throw new Error("cancelled debounce should not run");
});
