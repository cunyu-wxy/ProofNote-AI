const supportedSourceExtensions = [
  "txt",
  "text",
  "md",
  "markdown",
  "rst",
  "adoc",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "xml",
  "html",
  "htm",
  "log",
  "rtf"
];

const supportedSourceMimeTypes = new Set([
  "application/json",
  "application/rtf",
  "application/xml",
  "application/x-yaml",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/rtf",
  "text/tab-separated-values",
  "text/xml",
  "text/yaml"
]);

const supportedSourceExtensionPattern = new RegExp(
  `\\.(${supportedSourceExtensions.join("|")})$`,
  "i"
);

export const supportedSourceAccept = [
  ...supportedSourceExtensions.map((extension) => `.${extension}`),
  ...Array.from(supportedSourceMimeTypes)
].join(",");

export const supportedSourceLabel =
  ".txt, .md, .csv, .json, .yaml, .xml, .html, .rtf, .log";

export function isSupportedSourceFile(file: File) {
  return (
    supportedSourceExtensionPattern.test(file.name) ||
    supportedSourceMimeTypes.has(file.type) ||
    file.type.startsWith("text/")
  );
}

export function stripSupportedSourceExtension(fileName: string) {
  return fileName.replace(supportedSourceExtensionPattern, "");
}
