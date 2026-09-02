import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const exportDir = path.join(projectRoot, '.next-web');
const targetDir = path.join(projectRoot, 'hosting-dist');

try {
  await access(path.join(exportDir, 'index.html'));
} catch {
  throw new Error(
    'CloudBase static hosting is disabled: this build requires the Next.js server runtime for same-origin notice APIs. Deploy it to Vercel or another compatible Node.js host.'
  );
}

const excludedEntries = new Set([
  'cache',
  'diagnostics',
  'server',
  'standalone',
  'types',
  'trace'
]);

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

const filter = (source) => {
  const name = path.basename(source);

  if (excludedEntries.has(name)) {
    return false;
  }

  if (name.endsWith('.map') || name.endsWith('.log') || name.endsWith('.nft.json')) {
    return false;
  }

  return true;
};

await cp(exportDir, targetDir, {
  recursive: true,
  force: true,
  filter
});

console.log(`Prepared CloudBase hosting files at: ${targetDir}`);
