import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicCopyFiles = [
  new URL("../public/course-guide.html", import.meta.url),
  new URL("../src/pages/InterviewGuide.tsx", import.meta.url),
];

const retiredCourseNames = [
  "70分" + "お試し",
  "110分" + "リラックス",
];

test("公開ページに旧コース名を再掲載しない", async () => {
  for (const file of publicCopyFiles) {
    const source = await readFile(file, "utf8");
    for (const retiredName of retiredCourseNames) {
      assert.equal(source.includes(retiredName), false, `${file.pathname} に旧コース名が残っています`);
    }
  }
});
