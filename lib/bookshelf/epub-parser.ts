import { inflateRawSync } from "node:zlib";

export type ParsedEpubParagraph = {
  order_index: number;
  content: string;
};

export type ParsedEpubChapter = {
  order_index: number;
  title: string;
  paragraphs: ParsedEpubParagraph[];
};

export type ParsedEpubCover = {
  buffer: Buffer;
  contentType: string;
  extension: string;
};

export type ParsedEpubPayload = {
  title: string;
  author: string;
  language: string;
  description: string;
  cover?: ParsedEpubCover;
  chapters: ParsedEpubChapter[];
};

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
};

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
};

const TEXT_DECODER = new TextDecoder("utf-8");
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function getAttribute(tag: string, name: string) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return tag.match(pattern)?.[1] ?? "";
}

function getXmlText(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function normalizeZipPath(value: string) {
  const parts: string[] = [];

  for (const part of value.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return parts.join("/");
}

function joinZipPath(baseDir: string, href: string) {
  const pathWithoutFragment = href.split("#")[0] ?? href;
  return normalizeZipPath(baseDir ? `${baseDir}/${pathWithoutFragment}` : pathWithoutFragment);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("EPUB archive is missing a valid ZIP directory.");
}

function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, ZipEntry>();
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const endOffset = centralDirectoryOffset + centralDirectorySize;

  while (offset < endOffset) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      break;
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);
    const normalizedName = normalizeZipPath(fileName);

    if (normalizedName && !normalizedName.endsWith("/")) {
      entries.set(normalizedName, {
        name: normalizedName,
        method,
        compressedSize,
        localHeaderOffset
      });
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;

  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`EPUB archive has an invalid local header for ${entry.name}.`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.method === 0) {
    return Buffer.from(compressedData);
  }

  if (entry.method === 8) {
    return Buffer.from(inflateRawSync(compressedData));
  }

  throw new Error(`EPUB archive uses unsupported ZIP compression method ${entry.method}.`);
}

function readTextFile(buffer: Buffer, entries: Map<string, ZipEntry>, filePath: string) {
  const entry = entries.get(normalizeZipPath(filePath));

  if (!entry) {
    return "";
  }

  return TEXT_DECODER.decode(readZipEntry(buffer, entry));
}

function readBinaryFile(buffer: Buffer, entries: Map<string, ZipEntry>, filePath: string) {
  const entry = entries.get(normalizeZipPath(filePath));
  return entry ? readZipEntry(buffer, entry) : null;
}

function parseManifest(opf: string) {
  const manifest = new Map<string, ManifestItem>();
  const itemPattern = /<item\b[^>]*>/gi;
  const matches = opf.match(itemPattern) ?? [];

  for (const tag of matches) {
    const id = getAttribute(tag, "id");
    const href = getAttribute(tag, "href");

    if (!id || !href) {
      continue;
    }

    manifest.set(id, {
      id,
      href,
      mediaType: getAttribute(tag, "media-type"),
      properties: getAttribute(tag, "properties")
    });
  }

  return manifest;
}

function parseSpine(opf: string) {
  const spineMatch = opf.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i);
  const spineContent = spineMatch?.[1] ?? "";
  const itemrefs = spineContent.match(/<itemref\b[^>]*>/gi) ?? [];

  return itemrefs.map((tag) => getAttribute(tag, "idref")).filter(Boolean);
}

function getOpfBaseDir(opfPath: string) {
  const slashIndex = opfPath.lastIndexOf("/");
  return slashIndex >= 0 ? opfPath.slice(0, slashIndex) : "";
}

function getPackagePath(containerXml: string) {
  const rootfileTag = containerXml.match(/<rootfile\b[^>]*>/i)?.[0] ?? "";
  return getAttribute(rootfileTag, "full-path");
}

function parseNcxTitles(ncx: string, baseDir: string) {
  const titles = new Map<string, string>();
  const navPointPattern = /<navPoint\b[^>]*>([\s\S]*?)<\/navPoint>/gi;
  let match: RegExpExecArray | null;

  while ((match = navPointPattern.exec(ncx)) !== null) {
    const block = match[1];
    const label = getXmlText(block, "text");
    const contentTag = block.match(/<content\b[^>]*>/i)?.[0] ?? "";
    const src = getAttribute(contentTag, "src");

    if (label && src) {
      titles.set(joinZipPath(baseDir, src), label);
    }
  }

  return titles;
}

function parseNavTitles(navHtml: string, baseDir: string) {
  const titles = new Map<string, string>();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(navHtml)) !== null) {
    const title = stripTags(match[2]);

    if (title) {
      titles.set(joinZipPath(baseDir, match[1]), title);
    }
  }

  return titles;
}

function getTocTitles(buffer: Buffer, entries: Map<string, ZipEntry>, opf: string, manifest: Map<string, ManifestItem>, baseDir: string) {
  const titles = new Map<string, string>();
  const spineTag = opf.match(/<spine\b[^>]*>/i)?.[0] ?? "";
  const tocId = getAttribute(spineTag, "toc");
  const tocItem = (tocId && manifest.get(tocId)) || [...manifest.values()].find((item) => item.mediaType.includes("ncx"));
  const navItem = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));

  if (tocItem) {
    for (const [path, title] of parseNcxTitles(readTextFile(buffer, entries, joinZipPath(baseDir, tocItem.href)), baseDir)) {
      titles.set(path, title);
    }
  }

  if (navItem) {
    for (const [path, title] of parseNavTitles(readTextFile(buffer, entries, joinZipPath(baseDir, navItem.href)), baseDir)) {
      titles.set(path, title);
    }
  }

  return titles;
}

function extractParagraphs(html: string) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const blocks = body.match(/<(p|blockquote|li)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  const paragraphTexts = blocks.map(stripTags).filter((paragraph) => paragraph.length >= 2);

  if (paragraphTexts.length > 0) {
    return paragraphTexts;
  }

  return stripTags(body)
    .split(/\n{2,}|(?<=[。！？.!?])\s+(?=[\u4e00-\u9fffA-Z])/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length >= 2);
}

function getHtmlTitle(html: string, fallback: string) {
  return (
    stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") ||
    stripTags(html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "") ||
    stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") ||
    fallback
  );
}

function getCover(buffer: Buffer, entries: Map<string, ZipEntry>, opf: string, manifest: Map<string, ManifestItem>, baseDir: string) {
  const metaCoverId = opf.match(/<meta\b[^>]*name=["']cover["'][^>]*>/i);
  const metaCoverItemId = metaCoverId ? getAttribute(metaCoverId[0], "content") : "";
  const coverItem =
    [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("cover-image")) ||
    (metaCoverItemId ? manifest.get(metaCoverItemId) : null) ||
    [...manifest.values()].find((item) => item.id.toLowerCase().includes("cover") && item.mediaType.startsWith("image/"));

  if (!coverItem) {
    return undefined;
  }

  const coverBuffer = readBinaryFile(buffer, entries, joinZipPath(baseDir, coverItem.href));

  if (!coverBuffer) {
    return undefined;
  }

  const extension = coverItem.mediaType.includes("png") ? ".png" : coverItem.mediaType.includes("webp") ? ".webp" : ".jpg";

  return {
    buffer: coverBuffer,
    contentType: coverItem.mediaType || "image/jpeg",
    extension
  };
}

export function parseEpubBuffer(buffer: Buffer): ParsedEpubPayload {
  const entries = readZipEntries(buffer);
  const containerXml = readTextFile(buffer, entries, "META-INF/container.xml");
  const opfPath = getPackagePath(containerXml);

  if (!opfPath) {
    throw new Error("EPUB package metadata was not found.");
  }

  const opf = readTextFile(buffer, entries, opfPath);
  const baseDir = getOpfBaseDir(opfPath);
  const manifest = parseManifest(opf);
  const spine = parseSpine(opf);
  const titlesByPath = getTocTitles(buffer, entries, opf, manifest, baseDir);
  const chapters: ParsedEpubChapter[] = [];

  for (const idref of spine) {
    const item = manifest.get(idref);

    if (!item || !/(application\/xhtml\+xml|text\/html)/i.test(item.mediaType)) {
      continue;
    }

    const chapterPath = joinZipPath(baseDir, item.href);
    const html = readTextFile(buffer, entries, chapterPath);
    const paragraphTexts = extractParagraphs(html);

    if (paragraphTexts.length === 0) {
      continue;
    }

    chapters.push({
      order_index: chapters.length + 1,
      title: titlesByPath.get(chapterPath) || getHtmlTitle(html, `Chapter ${chapters.length + 1}`),
      paragraphs: paragraphTexts.map((content, index) => ({
        order_index: index + 1,
        content
      }))
    });
  }

  if (chapters.length === 0) {
    throw new Error("EPUB parser did not find readable chapters.");
  }

  return {
    title: getXmlText(opf, "dc:title") || "Untitled book",
    author: getXmlText(opf, "dc:creator") || "Unknown author",
    language: getXmlText(opf, "dc:language") || "unknown",
    description: getXmlText(opf, "dc:description") || "",
    cover: getCover(buffer, entries, opf, manifest, baseDir),
    chapters
  };
}
