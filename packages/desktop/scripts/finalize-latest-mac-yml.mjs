#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.env.LATEST_YML_DIR;
const outputDir = process.env.RUNNER_TEMP || '/tmp';

if (!rootDir) {
  throw new Error('LATEST_YML_DIR is required.');
}

async function listFilesRecursively(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function parseLatestYaml(content) {
  const lines = content.split('\n');
  const files = [];
  let version = '';
  let releaseDate = '';
  let current = null;

  const flush = () => {
    if (!current) return;
    if (current.url && current.sha512 && Number.isFinite(current.size)) {
      files.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const indented = line.startsWith('    ') || line.startsWith('  -');

    if (line.startsWith('version:')) {
      version = line.slice('version:'.length).trim();
      continue;
    }
    if (line.startsWith('releaseDate:')) {
      releaseDate = line.slice('releaseDate:'.length).trim().replace(/^'|'$/g, '');
      continue;
    }
    if (trimmed.startsWith('- url:')) {
      flush();
      current = { url: trimmed.slice('- url:'.length).trim() };
      continue;
    }
    if (!current) continue;
    if (!indented) {
      flush();
      continue;
    }
    if (trimmed.startsWith('sha512:')) {
      current.sha512 = trimmed.slice('sha512:'.length).trim();
      continue;
    }
    if (trimmed.startsWith('size:')) {
      current.size = Number(trimmed.slice('size:'.length).trim());
      continue;
    }
    if (trimmed.startsWith('blockMapSize:')) {
      current.blockMapSize = Number(trimmed.slice('blockMapSize:'.length).trim());
    }
  }

  flush();
  return { version, releaseDate, files };
}

function serializeLatestYaml(parsed) {
  const lines = [`version: ${parsed.version}`, 'files:'];
  for (const file of parsed.files) {
    lines.push(`  - url: ${file.url}`);
    lines.push(`    sha512: ${file.sha512}`);
    lines.push(`    size: ${file.size}`);
    if (Number.isFinite(file.blockMapSize)) {
      lines.push(`    blockMapSize: ${file.blockMapSize}`);
    }
  }
  lines.push(`releaseDate: '${parsed.releaseDate}'`);
  return `${lines.join('\n')}\n`;
}

const allFiles = await listFilesRecursively(rootDir);
const manifestPaths = allFiles.filter((candidate) => path.basename(candidate) === 'latest-mac.yml');

if (manifestPaths.length === 0) {
  throw new Error(`No latest-mac.yml files found under ${rootDir}.`);
}

const parsedEntries = [];
for (const manifestPath of manifestPaths) {
  const raw = await fs.readFile(manifestPath, 'utf8');
  parsedEntries.push(parseLatestYaml(raw));
}

const base = parsedEntries.find((entry) => entry.version)?.version
  ? parsedEntries.find((entry) => entry.version)
  : parsedEntries[0];

if (!base || !base.version || !base.releaseDate) {
  throw new Error('Could not parse version/releaseDate from latest-mac.yml files.');
}

const mergedFiles = [];
const seen = new Set();
for (const entry of parsedEntries) {
  for (const file of entry.files) {
    const key = `${file.url}\u0000${file.sha512}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mergedFiles.push(file);
  }
}

mergedFiles.sort((left, right) => left.url.localeCompare(right.url));

const outputPath = path.join(outputDir, 'latest-mac.yml');
const output = serializeLatestYaml({
  version: base.version,
  releaseDate: base.releaseDate,
  files: mergedFiles
});

await fs.writeFile(outputPath, output);
console.log(`Merged latest-mac.yml written to ${outputPath}`);
