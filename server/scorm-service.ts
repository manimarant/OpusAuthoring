import { CourseWithContent } from "@shared/schema";
import { create } from "xmlbuilder2";
import JSZip from "jszip";

export async function createScormPackage(course: CourseWithContent): Promise<Buffer> {
  const zip = new JSZip();

  zip.file("imsmanifest.xml", generateScormManifest(course));
  zip.file("index.html", renderScormCoursePage(course));

  return zip.generateAsync({ type: "nodebuffer" });
}

export function generateScormManifest(course: CourseWithContent): string {
  const manifestIdentifier = `course_${course.id}`;
  const resourceIdentifier = `resource_${course.id}`;

  return create({ version: "1.0", encoding: "UTF-8" })
    .ele("manifest", {
      identifier: manifestIdentifier,
      version: "1.2",
      xmlns: "http://www.imsproject.org/xsd/imscp_rootv1p1p2",
      "xmlns:adlcp": "http://www.adlnet.org/xsd/adlcp_rootv1p2",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:schemaLocation": [
        "http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd",
        "http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd",
      ].join(" "),
    })
    .ele("metadata")
      .ele("schema").txt("ADL SCORM").up()
      .ele("schemaversion").txt("1.2").up()
    .up()
    .ele("organizations", { default: "default_org" })
      .ele("organization", { identifier: "default_org" })
        .ele("title").txt(course.title).up()
        .ele("item", { identifier: `item_${course.id}`, identifierref: resourceIdentifier, isvisible: "true" })
          .ele("title").txt(course.title).up()
        .up()
      .up()
    .up()
    .ele("resources")
      .ele("resource", {
        identifier: resourceIdentifier,
        type: "webcontent",
        "adlcp:scormtype": "sco",
        href: "index.html",
      })
        .ele("file", { href: "index.html" }).up()
      .up()
    .up()
    .end({ prettyPrint: true });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBlock(block: CourseWithContent["modules"][number]["contentBlocks"][number]) {
  const content = (block.content || {}) as Record<string, any>;

  switch (block.type) {
    case "text":
    case "ai-text":
      return `<section class="block text-block">${typeof content.html === "string" && content.html.trim()
        ? content.html
        : `<p>${escapeHtml(String(content.text || ""))}</p>`}</section>`;
    case "heading":
      return `<section class="block"><h2>${escapeHtml(String(content.text || ""))}</h2></section>`;
    case "statement":
      return `<section class="block statement-block"><p>${escapeHtml(String(content.text || ""))}</p></section>`;
    case "quote":
      return `<section class="block quote-block"><blockquote>${escapeHtml(String(content.text || ""))}</blockquote></section>`;
    case "image":
    case "ai-image":
      return typeof content.url === "string" && content.url
        ? `<section class="block image-block"><img src="${escapeHtml(content.url)}" alt="${escapeHtml(String(content.alt || ""))}" />${content.caption ? `<p class="caption">${escapeHtml(String(content.caption))}</p>` : ""}</section>`
        : "";
    case "list": {
      const items = Array.isArray(content.items) ? content.items : [];
      const listTag = content.type === "ordered" ? "ol" : "ul";
      const listItems = items
        .map((item: any) => `<li>${escapeHtml(String(item?.text || ""))}</li>`)
        .join("");
      return `<section class="block list-block">${content.title ? `<h3>${escapeHtml(String(content.title))}</h3>` : ""}<${listTag}>${listItems}</${listTag}></section>`;
    }
    case "quiz":
    case "ai-quiz": {
      const questions = Array.isArray(content.questions) ? content.questions : [];
      return `<section class="block quiz-block">${content.title ? `<h3>${escapeHtml(String(content.title))}</h3>` : ""}${questions
        .map((question: any, index: number) => `<div class="quiz-question"><p><strong>Question ${index + 1}.</strong> ${escapeHtml(String(question?.question || ""))}</p></div>`)
        .join("")}</section>`;
    }
    case "assignment":
    case "ai-assignment":
      return `<section class="block assignment-block">${content.title ? `<h3>${escapeHtml(String(content.title))}</h3>` : ""}${content.description ? `<p>${escapeHtml(String(content.description))}</p>` : ""}</section>`;
    default:
      return `<section class="block"><pre>${escapeHtml(JSON.stringify(content, null, 2))}</pre></section>`;
  }
}

function renderScormCoursePage(course: CourseWithContent) {
  const topLevelModules = course.modules
    .filter((module) => !module.parentModuleId)
    .sort((a, b) => parseInt(a.order, 10) - parseInt(b.order, 10));

  const moduleHtml = topLevelModules
    .map((module) => {
      const chapters = course.modules
        .filter((candidate) => candidate.parentModuleId === module.id)
        .sort((a, b) => parseInt(a.order, 10) - parseInt(b.order, 10));

      const chapterHtml = (chapters.length > 0 ? chapters : [module])
        .map((chapter) => {
          const blocks = chapter.contentBlocks
            .slice()
            .sort((a, b) => parseInt(a.order, 10) - parseInt(b.order, 10))
            .map(renderBlock)
            .join("");

          return `
            <article class="chapter">
              <h3>${escapeHtml(chapter.title)}</h3>
              ${chapter.description ? `<p class="chapter-description">${escapeHtml(chapter.description)}</p>` : ""}
              ${blocks || '<p class="empty-state">No chapter content is available in this export.</p>'}
            </article>
          `;
        })
        .join("");

      return `
        <section class="module">
          <h2>${escapeHtml(module.title)}</h2>
          ${module.description ? `<p class="module-description">${escapeHtml(module.description)}</p>` : ""}
          ${chapterHtml}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(course.title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; background: #ffffff; color: #2f3437; }
        .page { max-width: 980px; margin: 0 auto; padding: 40px 28px 64px; }
        h1, h2, h3 { margin: 0; color: #1f2937; }
        h1 { font-size: 2.2rem; line-height: 1.15; }
        h2 { font-size: 1.6rem; margin-top: 32px; padding-top: 28px; border-top: 1px solid #e5e7eb; }
        h3 { font-size: 1.15rem; margin-top: 24px; }
        p, li { font-size: 1rem; line-height: 1.7; }
        .objective, .module-description, .chapter-description, .empty-state, .caption { color: #5f6b76; }
        .chapter { margin-top: 16px; }
        .block { padding: 12px 0; border-bottom: 1px solid #eceff1; }
        .block:last-child { border-bottom: none; }
        .statement-block { background: #f8fafc; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .quote-block blockquote { margin: 0; padding-left: 16px; border-left: 3px solid #cbd5e1; font-style: italic; }
        .image-block img { max-width: 100%; border-radius: 12px; display: block; }
        ul, ol { padding-left: 24px; }
        pre { white-space: pre-wrap; word-break: break-word; background: #f8fafc; padding: 12px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <main class="page">
        <h1>${escapeHtml(course.title)}</h1>
        ${course.learningObjectives ? `<p class="objective">${escapeHtml(course.learningObjectives)}</p>` : ""}
        ${moduleHtml || '<p class="empty-state">No modules are available in this export.</p>'}
      </main>
    </body>
  </html>`;
}
