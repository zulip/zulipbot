import type { Check } from "../moderation.ts";

const PRECISE_SCREENSHOTS_GUIDE_LINK =
  "https://zulip.readthedocs.io/en/latest/contributing/presenting-visual-changes.html#what-are-precise-before-after-screenshots";

// An image or video in the description: a Markdown image, an <img> or
// <video> tag, a GitHub attachment, or a link to an image or video file.
// Whether they are precise before/after screenshots is for the reviewer.
const evidence = [
  /!\[[^\]]*\]\(/v,
  /<(?:img|video)\b/iv,
  /https:\/\/(?:github\.com\/user-attachments\/|(?:private-)?user-images\.githubusercontent\.com\/|github\.com\/[\w\-.]+\/[\w\-.]+\/assets\/)/iv,
  /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|mp4|mov|webm)\b/iv,
];

/**
 * Ask for screenshots when a pull request changes files under the
 * configured paths and its description has none. The paths are a
 * heuristic for changes to the user interface.
 */
export const screenshots: Check = async (bot, context) => {
  const { paths } = bot.cfg.pulls.moderation.screenshots;
  const description = context.pull.body ?? "";
  if (
    paths.length === 0 ||
    evidence.some((pattern) => pattern.test(description))
  ) {
    return [];
  }

  const files = await context.files();
  const visual = files.find((file) =>
    paths.some((path) => file.filename.startsWith(path)),
  );
  if (visual === undefined) return [];

  return [
    {
      check: "screenshots",
      message: `This pull request changes files that affect the user interface, such as \`${visual.filename}\`, but its description has no screenshots or videos. Please add [precise before/after screenshots](${PRECISE_SCREENSHOTS_GUIDE_LINK}) to the pull request description, including any parts that should look the same as before.`,
    },
  ];
};
