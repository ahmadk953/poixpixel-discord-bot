import path from 'path';
import process from 'process';

const buildEslintCommand = (filenames) => {
  const srcDir = path.resolve(process.cwd(), 'src');
  const srcFiles = filenames.filter((f) => {
    const absolute = path.resolve(process.cwd(), f);
    const relativeToSrc = path.relative(srcDir, absolute);
    return !relativeToSrc.startsWith('..');
  });
  if (srcFiles.length === 0) return [];
  return `eslint ${srcFiles
    .map((f) => path.relative(process.cwd(), f))
    .join(' ')}`;
};

const prettierCommand = 'prettier --write';

export default {
  '*.{js,mjs,ts,mts}': [prettierCommand, buildEslintCommand],
  '*.json': [prettierCommand],
};
